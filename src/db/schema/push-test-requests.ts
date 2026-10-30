import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { pushSubscriptions } from "./push-subscriptions";

/**
 * 通知設定の「テスト通知を送る」で予約された、端末（購読）へのテスト通知。
 * 次のスケジュール実行（15 分ごと）で通常の通知と同じ経路で送り、送り終えたら行を削除する
 * （`src/workflows/notification.ts`・`src/features/push/sendTestPush.ts`）。
 * 1 つの端末につき予約は 1 件だけにするため `subscription_id` を一意にする。
 * 購読が削除されたら予約も不要なので `onDelete: "cascade"` とする
 */
export const pushTestRequests = sqliteTable("push_test_requests", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  subscriptionId: text("subscription_id")
    .notNull()
    .unique()
    .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
  requestedAt: integer("requested_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type PushTestRequest = typeof pushTestRequests.$inferSelect;
export type NewPushTestRequest = typeof pushTestRequests.$inferInsert;
