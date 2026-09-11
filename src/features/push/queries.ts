import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notifications, pushDeliveries, pushSubscriptions } from "@/db/schema";

export async function listPushSubscriptions(d1?: D1Database) {
  const db = getDb(d1);
  return db.select().from(pushSubscriptions);
}

/**
 * 指定した通知に対して、すでに送信が完了している (notification_id, subscription_id) の組。
 * 前回のスケジュール実行で一部の購読だけ送信できた通知を再試行する際、成功済みの購読へ
 * 重複送信しないために使う（`src/workflows/notification.ts` 参照）
 */
export async function listPushDeliveries(
  notificationIds: string[],
  d1?: D1Database,
) {
  if (notificationIds.length === 0) {
    return [];
  }
  const db = getDb(d1);
  return db
    .select({
      notificationId: pushDeliveries.notificationId,
      subscriptionId: pushDeliveries.subscriptionId,
    })
    .from(pushDeliveries)
    .where(inArray(pushDeliveries.notificationId, notificationIds));
}

/**
 * まだ Push 送信していない（`pushed_at` が NULL）未対応の通知一覧。
 * `src/features/notifications/queries.ts` の `listPendingNotifications` と同じ
 * 未対応判定に、送信済みかどうかの条件を加えたもの
 */
export async function listUnpushedNotifications(now: Date, d1?: D1Database) {
  const db = getDb(d1);
  return db
    .select()
    .from(notifications)
    .where(
      and(
        isNull(notifications.pushedAt),
        or(
          eq(notifications.status, "pending"),
          and(
            eq(notifications.status, "snoozed"),
            lte(notifications.snoozedUntil, now),
          ),
        ),
      ),
    );
}
