import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Web Push（`29`）の購読。猫には紐付かない、端末ごとの購読情報。
 * `endpoint` は購読ごとに一意（同じ端末・ブラウザから再購読すると更新される）
 */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
