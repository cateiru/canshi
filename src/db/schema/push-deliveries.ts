import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { notifications } from "./notifications";
import { pushSubscriptions } from "./push-subscriptions";

/**
 * 通知 × 購読の送信結果（`29` レビュー対応）。行が存在する = その組み合わせへの送信は
 * 完了しているという意味で使う。`(notification_id, subscription_id)` を一意にすることで、
 * 複数端末のうち一部だけが失敗したケースで、成功済み端末へ重複送信せず失敗端末だけを
 * 次のスケジュール実行で再試行できる（`src/workflows/notification.ts` 参照）
 */
export const pushDeliveries = sqliteTable(
  "push_deliveries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => pushSubscriptions.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    unique("push_deliveries_notification_subscription_unique").on(
      table.notificationId,
      table.subscriptionId,
    ),
  ],
);

export type PushDelivery = typeof pushDeliveries.$inferSelect;
export type NewPushDelivery = typeof pushDeliveries.$inferInsert;
