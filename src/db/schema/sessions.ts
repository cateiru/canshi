import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * ログインセッション。Cookie にはランダムなセッショントークンだけを保存し、
 * DB にはそのハッシュ（SHA-256）を持つ。DB が漏れてもトークンを復元できないようにする
 * （`src/features/auth/sessions.ts`）。ログアウトで行を削除すると、そのセッションは
 * 直ちに使えなくなる
 */
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // この日時を過ぎたセッションは無効。ログインから延長しない
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
