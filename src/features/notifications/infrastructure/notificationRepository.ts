import { and, eq, exists, inArray, isNull, ne, sql } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
import {
  cleaningRecords,
  cleaningTargets,
  notifications,
  pushDeliveries,
  symptoms,
} from "@/db/schema";
import type { NotificationRepository } from "../domain/notificationRepository";
import {
  ACCESSIBLE_NOTIFICATIONS_CONDITION_PARAMETERS,
  accessibleNotificationsCondition,
} from "./access";

/** D1 に保存する `NotificationRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createNotificationRepository(
  d1?: D1Database,
): NotificationRepository {
  const db = getDb(d1);
  /**
   * 指定した ID の通知のうち、ユーザーが参照できる通知だけに一致する条件。
   * 別の家の通知は、存在しない通知と同じく更新対象にしない
   */
  const accessibleNotification = (userId: string, id: string) =>
    and(eq(notifications.id, id), accessibleNotificationsCondition(db, userId));

  return {
    async findAccessible(userId, id) {
      const [notification] = await db
        .select({
          id: notifications.id,
          catId: notifications.catId,
          kind: notifications.kind,
          referenceId: notifications.referenceId,
          status: notifications.status,
        })
        .from(notifications)
        .where(accessibleNotification(userId, id))
        .limit(1);
      return notification ?? null;
    },

    async setStatusIfAccessible(userId, id, status) {
      await db
        .update(notifications)
        .set({ status, updatedAt: new Date() })
        .where(accessibleNotification(userId, id));
    },

    async completeWithCleaningRecord(id, performedAt, actor) {
      // 完了の判定は呼び出し側のバッチ外の読み取りのため、別タブ・別端末から同じ通知を同時に完了すると
      // 両方が未完了と判断しうる。記録の追加を「通知が未完了なら」という条件付きの
      // INSERT ... SELECT にし、完了への更新と同じバッチ（D1 では 1 トランザクション）で
      // 実行することで、後から実行されたバッチでは記録が追加されないようにする。
      // INSERT ... SELECT では `$defaultFn` が効かないため、全カラムの値を明示する
      const cleaningRecordId = crypto.randomUUID();
      await db.batch([
        db.insert(cleaningRecords).select(
          db
            .select({
              id: sql`${cleaningRecordId}`.as("id"),
              catId: notifications.catId,
              cleaningTargetId: cleaningTargets.id,
              performedAt:
                sql`${sql.param(performedAt, cleaningRecords.performedAt)}`.as(
                  "performedAt",
                ),
              memo: sql`null`.as("memo"),
              createdAt: sql`(unixepoch())`.as("createdAt"),
              updatedAt: sql`(unixepoch())`.as("updatedAt"),
              deletedAt: sql`null`.as("deletedAt"),
            })
            .from(notifications)
            .innerJoin(
              cleaningTargets,
              and(
                eq(cleaningTargets.id, notifications.referenceId),
                eq(cleaningTargets.catId, notifications.catId),
              ),
            )
            .where(
              and(
                eq(notifications.id, id),
                ne(notifications.status, "done"),
                eq(cleaningTargets.isActive, true),
              ),
            ),
        ),
        // 完了済みの通知などで記録が追加されなかったときは、履歴も追加しない
        insertRecordChangeLog(
          db,
          {
            recordType: "cleaning_record",
            recordId: cleaningRecordId,
            action: "create",
            actor,
          },
          exists(
            db
              .select({ id: cleaningRecords.id })
              .from(cleaningRecords)
              .where(eq(cleaningRecords.id, cleaningRecordId)),
          ),
        ),
        db
          .update(notifications)
          .set({ status: "done", updatedAt: new Date() })
          .where(eq(notifications.id, id)),
      ]);
    },

    async completeWithSymptomResolved(id, catId, symptomId, actor) {
      const isUnresolved = and(
        eq(symptoms.id, symptomId),
        eq(symptoms.catId, catId),
        ne(symptoms.status, "resolved"),
        isNull(symptoms.deletedAt),
      );
      // 2つの更新は同じバッチ（D1 では 1 トランザクション）で実行し、片方だけが反映されないようにする。
      // 更新の後は「未解消」の条件が偽になるため、履歴を先に追加する
      await db.batch([
        insertRecordChangeLog(
          db,
          {
            recordType: "symptom",
            recordId: symptomId,
            action: "update",
            actor,
          },
          exists(
            db.select({ id: symptoms.id }).from(symptoms).where(isUnresolved),
          ),
        ),
        db
          .update(symptoms)
          .set({ status: "resolved", updatedAt: new Date() })
          .where(isUnresolved),
        db
          .update(notifications)
          .set({ status: "done", updatedAt: new Date() })
          .where(eq(notifications.id, id)),
      ]);
    },

    async completeOngoingSymptomNotifications(catId, symptomId) {
      await db
        .update(notifications)
        .set({ status: "done", updatedAt: new Date() })
        .where(
          and(
            eq(notifications.kind, "symptom_ongoing"),
            eq(notifications.referenceId, symptomId),
            eq(notifications.catId, catId),
            inArray(notifications.status, ["pending", "snoozed"]),
          ),
        );
    },

    async snooze(id, snoozedUntil) {
      // `push_deliveries` の行（`29` の送信済み記録）も削除しないと、`pushedAt` を null に
      // 戻しても Workflow が「この購読へは送信済み」と判断して再送しない（`src/workflows/notification.ts`
      // の `delivered` 参照）ため、期日到来後に Push が届かなくなる
      await db.batch([
        db
          .update(notifications)
          .set({
            status: "snoozed",
            snoozedUntil,
            readAt: null,
            pushedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(notifications.id, id)),
        db.delete(pushDeliveries).where(eq(pushDeliveries.notificationId, id)),
      ]);
    },

    async markReadIfAccessible(userId, ids, readAt) {
      // `set` の既読日時（1 個）と `accessibleNotificationsCondition` の userId の分を予約する
      for (const chunk of chunkForBoundParameters(
        ids,
        1 + ACCESSIBLE_NOTIFICATIONS_CONDITION_PARAMETERS,
      )) {
        await db
          .update(notifications)
          .set({ readAt })
          .where(
            and(
              inArray(notifications.id, chunk),
              accessibleNotificationsCondition(db, userId),
            ),
          );
      }
    },
  };
}
