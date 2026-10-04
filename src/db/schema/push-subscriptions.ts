import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * Web Push（`29`）の購読。猫には紐付かない、端末ごとの購読情報。
 * `endpoint` は購読ごとに一意（同じ端末・ブラウザから再購読すると更新される）。
 * 購読したユーザーを持ち、そのユーザーの家の猫の通知だけを送る（`src/workflows/notification.ts`）
 */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // 購読したユーザー。ユーザーの導入（`0036`）より前の購読は NULL で、どの通知も送らない。
  // `scripts/link-household.mts` でユーザーに紐付ける
  userId: text("user_id").references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  // 送信失敗のたびに加算する。一定回数を超えたら購読を削除する
  // （`src/features/push/defaults.ts` の `MAX_PUSH_FAILURE_COUNT`）
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
