import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { apiTokens } from "./api-tokens";

/**
 * API（`/api/v1`）へのアクセスの履歴。使えるトークンで呼ばれたリクエストごとに 1 行を追加する。
 * 画面では、トークンを最後に使った日時（トークンごとの `created_at` の最大値）だけに使う。
 * トークンを削除したときに、その履歴も削除する
 */
export const apiAccessLogs = sqliteTable(
  "api_access_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    apiTokenId: text("api_token_id")
      .notNull()
      .references(() => apiTokens.id),
    method: text("method").notNull(),
    // クエリを除いたパス（長さを切り詰めて保存する）
    path: text("path").notNull(),
    // 応答の HTTP ステータス
    status: integer("status").notNull(),
    // 送信元の IP アドレス（`CF-Connecting-IP`）。Cloudflare を通らないローカルの開発では NULL
    ipAddress: text("ip_address"),
    // User-Agent（長さを切り詰めて保存する）。送られなければ NULL
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // トークンごとに最後に使った日時を求めるため
    index("api_access_logs_api_token_id_created_at_idx").on(
      table.apiTokenId,
      table.createdAt,
    ),
  ],
);

export type ApiAccessLog = typeof apiAccessLogs.$inferSelect;
export type NewApiAccessLog = typeof apiAccessLogs.$inferInsert;
