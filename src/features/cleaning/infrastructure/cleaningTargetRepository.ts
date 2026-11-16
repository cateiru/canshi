import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insertWhere, writableCatCondition } from "@/db/conditionalInsert";
import { deleteRecordChangeLogsOf } from "@/db/recordChangeLog";
import {
  cleaningRecords,
  cleaningTargets,
  notificationSettings,
  notifications,
} from "@/db/schema";
import type { CleaningTargetRepository } from "../domain/cleaningTargetRepository";

/** D1 に保存する `CleaningTargetRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createCleaningTargetRepository(
  d1?: D1Database,
): CleaningTargetRepository {
  const db = getDb(d1);
  const byId = (catId: string, id: string) =>
    and(eq(cleaningTargets.id, id), eq(cleaningTargets.catId, catId));
  // 書き込みの文の条件。メモリーへ移した猫の掃除対象は書き換えない
  const writableById = (catId: string, id: string) =>
    and(byId(catId, id), writableCatCondition(catId));

  /** 新しい掃除対象を一覧の末尾に並べるための並び順 */
  async function nextSortOrder(catId: string): Promise<number> {
    const [row] = await db
      .select({
        maxSortOrder: sql<number | null>`max(${cleaningTargets.sortOrder})`,
      })
      .from(cleaningTargets)
      .where(eq(cleaningTargets.catId, catId));
    return row?.maxSortOrder == null ? 0 : Number(row.maxSortOrder) + 1;
  }

  return {
    async findScheduleForCat(catId, id, { activeOnly }) {
      const [target] = await db
        .select({
          id: cleaningTargets.id,
          frequencyValue: cleaningTargets.frequencyValue,
          frequencyUnit: cleaningTargets.frequencyUnit,
          notifyTime: cleaningTargets.notifyTime,
        })
        .from(cleaningTargets)
        .where(
          and(
            byId(catId, id),
            ...(activeOnly ? [eq(cleaningTargets.isActive, true)] : []),
          ),
        )
        .limit(1);
      return target ?? null;
    },
    async add(catId, content) {
      // メモリーへ移した猫には追加しない
      await insertWhere(
        db,
        cleaningTargets,
        { catId, ...content, sortOrder: await nextSortOrder(catId) },
        writableCatCondition(catId),
      );
    },
    async update(catId, id, content) {
      const result = await db
        .update(cleaningTargets)
        .set({ ...content, updatedAt: new Date() })
        .where(writableById(catId, id))
        .returning({ id: cleaningTargets.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      // cleaning_records から cleaning_targets への外部キー制約があるため実施記録も同時に削除する。
      // notifications・notification_settings の reference_id もこの対象を指しうるため
      // （`28`）、同じ batch でまとめて削除する。delete の間に別リクエストが
      // 割り込まないよう、D1 の batch で原子的に実行する。
      // メモリーへ移した猫の掃除対象は、どの文も削除しない
      const writable = writableCatCondition(catId);
      await db.batch([
        // 実施記録を物理削除するため、履歴も消す
        deleteRecordChangeLogsOf(
          db,
          "cleaning_record",
          cleaningRecords,
          and(
            eq(cleaningRecords.cleaningTargetId, id),
            eq(cleaningRecords.catId, catId),
            writable,
          ),
        ),
        db
          .delete(cleaningRecords)
          .where(
            and(
              eq(cleaningRecords.cleaningTargetId, id),
              eq(cleaningRecords.catId, catId),
              writable,
            ),
          ),
        db
          .delete(notifications)
          .where(
            and(
              eq(notifications.kind, "cleaning_due"),
              eq(notifications.referenceId, id),
              eq(notifications.catId, catId),
              writable,
            ),
          ),
        db
          .delete(notificationSettings)
          .where(
            and(
              eq(notificationSettings.kind, "cleaning_due"),
              eq(notificationSettings.referenceId, id),
              eq(notificationSettings.catId, catId),
              writable,
            ),
          ),
        db.delete(cleaningTargets).where(writableById(catId, id)),
      ]);
    },
  };
}
