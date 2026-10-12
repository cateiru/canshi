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
    // 端末一覧で個別にログアウトするときにセッションを指す ID。トークンのハッシュは
    // 画面に出さず、こちらを使う。既存の行やこの列を知らないコードの INSERT でも
    // 値が入るよう、DB 側の既定値で乱数を振る
    id: text("id")
      .notNull()
      .unique()
      .default(sql`(lower(hex(randomblob(16))))`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // ログインしたときのブラウザの User-Agent（長さを切り詰めて保存する）。端末一覧で
    // 端末名に変換して表示する。この列を追加する前のセッションは NULL
    userAgent: text("user_agent"),
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
