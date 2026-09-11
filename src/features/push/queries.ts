import { and, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notifications, pushSubscriptions } from "@/db/schema";

export async function listPushSubscriptions(d1?: D1Database) {
  const db = getDb(d1);
  return db.select().from(pushSubscriptions);
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
