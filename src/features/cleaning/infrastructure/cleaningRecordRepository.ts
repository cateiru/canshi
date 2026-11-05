import { and, eq, exists, inArray, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cleaningRecords, notifications } from "@/db/schema";
import type { CleaningRecordRepository } from "../domain/cleaningRecordRepository";

/** D1 に保存する `CleaningRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createCleaningRecordRepository(
  d1?: D1Database,
): CleaningRecordRepository {
  const db = getDb(d1);
  const byId = (catId: string, cleaningTargetId: string, id: string) =>
    and(
      eq(cleaningRecords.id, id),
      eq(cleaningRecords.catId, catId),
      eq(cleaningRecords.cleaningTargetId, cleaningTargetId),
      isNull(cleaningRecords.deletedAt),
    );

  /**
   * 掃除対象の未対応の掃除の通知のうち、`dueBefore` より前の予定日のものを完了にする文。
   * 実施記録が削除されずにあるときだけ完了にし、確認の後に記録が論理削除された場合は通知に触れない
   * （記録の追加では、同じ batch の先頭で挿入した記録を見る）
   */
  function completeNotifications(
    catId: string,
    cleaningTargetId: string,
    cleaningRecordId: string,
    dueBefore: Date | null,
  ) {
    if (dueBefore == null) {
      return [];
    }
    return [
      db
        .update(notifications)
        .set({ status: "done", updatedAt: new Date() })
        .where(
          and(
            eq(notifications.catId, catId),
            eq(notifications.kind, "cleaning_due"),
            eq(notifications.referenceId, cleaningTargetId),
            inArray(notifications.status, ["pending", "snoozed"]),
            lt(notifications.dueAt, dueBefore),
            exists(
              db
                .select({ id: cleaningRecords.id })
                .from(cleaningRecords)
                .where(byId(catId, cleaningTargetId, cleaningRecordId)),
            ),
          ),
        ),
    ];
  }

  return {
    async findPerformedAt(catId, cleaningTargetId, id) {
      const [row] = await db
        .select({ performedAt: cleaningRecords.performedAt })
        .from(cleaningRecords)
        .where(byId(catId, cleaningTargetId, id))
        .limit(1);
      return row?.performedAt ?? null;
    },
    async add(
      catId,
      cleaningTargetId,
      content,
      completeNotificationsDueBefore,
    ) {
      const id = crypto.randomUUID();
      await db.batch([
        db
          .insert(cleaningRecords)
          .values({ id, catId, cleaningTargetId, ...content }),
        ...completeNotifications(
          catId,
          cleaningTargetId,
          id,
          completeNotificationsDueBefore,
        ),
      ]);
      return id;
    },
    async update(
      catId,
      cleaningTargetId,
      id,
      content,
      completeNotificationsDueBefore,
    ) {
      const [updated] = await db.batch([
        db
          .update(cleaningRecords)
          .set({ ...content, updatedAt: new Date() })
          .where(byId(catId, cleaningTargetId, id))
          .returning({ id: cleaningRecords.id }),
        ...completeNotifications(
          catId,
          cleaningTargetId,
          id,
          completeNotificationsDueBefore,
        ),
      ]);
      return updated.length > 0;
    },
    async remove(catId, cleaningTargetId, id) {
      const result = await db
        .update(cleaningRecords)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(byId(catId, cleaningTargetId, id))
        .returning({ id: cleaningRecords.id });
      return result.length > 0;
    },
  };
}
