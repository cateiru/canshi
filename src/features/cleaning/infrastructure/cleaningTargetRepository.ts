import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
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
      await db.insert(cleaningTargets).values({
        catId,
        ...content,
        sortOrder: await nextSortOrder(catId),
      });
    },
    async update(catId, id, content) {
      const result = await db
        .update(cleaningTargets)
        .set({ ...content, updatedAt: new Date() })
        .where(byId(catId, id))
        .returning({ id: cleaningTargets.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      // cleaning_records から cleaning_targets への外部キー制約があるため実施記録も同時に削除する。
      // notifications・notification_settings の reference_id もこの対象を指しうるため
      // （`28`）、同じ batch でまとめて削除する。delete の間に別リクエストが
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
        db.delete(cleaningTargets).where(byId(catId, id)),
      ]);
    },
  };
}
