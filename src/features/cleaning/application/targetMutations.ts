import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  type CleaningTarget,
  cleaningRecords,
  cleaningTargets,
  notificationSettings,
  notifications,
} from "@/db/schema";
import type { CleaningTargetFormInput } from "../domain/targetSchema";

/*
 * 掃除対象の保存。猫を参照できるかは呼び出し側で確かめる。
 * ほかの記録の mutations と揃えて、D1 は引数でも受け取れるようにする
 */

/** 新しい掃除対象を一覧の末尾に並べるための並び順 */
async function nextSortOrder(
  db: ReturnType<typeof getDb>,
  catId: string,
): Promise<number> {
  const [row] = await db
    .select({
      maxSortOrder: sql<number | null>`max(${cleaningTargets.sortOrder})`,
    })
    .from(cleaningTargets)
    .where(eq(cleaningTargets.catId, catId));
  return row?.maxSortOrder == null ? 0 : Number(row.maxSortOrder) + 1;
}

/** 掃除対象を一覧の末尾に追加する */
export async function createCleaningTarget(
  catId: string,
  data: Pick<
    CleaningTarget,
    "name" | "frequencyValue" | "frequencyUnit" | "isActive"
  > &
    Partial<Pick<CleaningTarget, "notifyTime">>,
  d1?: D1Database,
): Promise<void> {
  const db = getDb(d1);
  await db.insert(cleaningTargets).values({
    catId,
    name: data.name,
    frequencyValue: data.frequencyValue,
    frequencyUnit: data.frequencyUnit,
    isActive: data.isActive,
    notifyTime: data.notifyTime,
    sortOrder: await nextSortOrder(db, catId),
  });
}

/** 猫の掃除対象を更新する。見つからなければ false */
export async function updateCleaningTarget(
  catId: string,
  id: string,
  data: CleaningTargetFormInput,
  d1?: D1Database,
): Promise<boolean> {
  const result = await getDb(d1)
    .update(cleaningTargets)
    .set({
      name: data.name,
      frequencyValue: data.frequencyValue,
      frequencyUnit: data.frequencyUnit,
      isActive: data.isActive,
      notifyTime: data.notifyTime,
      updatedAt: new Date(),
    })
    .where(and(eq(cleaningTargets.id, id), eq(cleaningTargets.catId, catId)))
    .returning({ id: cleaningTargets.id });
  return result.length > 0;
}

/** 猫の掃除対象を、実施記録・通知・通知設定ごと削除する */
export async function deleteCleaningTarget(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<void> {
  const db = getDb(d1);
  // cleaning_records から cleaning_targets への外部キー制約があるため実施記録も同時に削除する。
  // notifications・notification_settings の reference_id もこの対象を指しうるため
  // （`28`）、同じ batch でまとめて削除する。3つの delete の間に別リクエストが
  // 割り込まないよう、D1 の batch で原子的に実行する
  await db.batch([
    db
      .delete(cleaningRecords)
      .where(
        and(
          eq(cleaningRecords.cleaningTargetId, id),
          eq(cleaningRecords.catId, catId),
        ),
      ),
    db
      .delete(notifications)
      .where(
        and(
          eq(notifications.kind, "cleaning_due"),
          eq(notifications.referenceId, id),
          eq(notifications.catId, catId),
        ),
      ),
    db
      .delete(notificationSettings)
      .where(
        and(
          eq(notificationSettings.kind, "cleaning_due"),
          eq(notificationSettings.referenceId, id),
          eq(notificationSettings.catId, catId),
        ),
      ),
    db
      .delete(cleaningTargets)
      .where(and(eq(cleaningTargets.id, id), eq(cleaningTargets.catId, catId))),
  ]);
}
