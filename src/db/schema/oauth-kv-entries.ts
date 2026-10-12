import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * MCP の OAuth 認可サーバー（`@cloudflare/workers-oauth-provider`）の保存先。
 * ライブラリは Workers KV（`env.OAUTH_KV`）に保存する作りのため、KV と同じ操作を
 * このテーブルで実装したもの（`src/features/mcp/d1KvStore.ts`）を渡している。
 * キー・値の形式はライブラリが決める（`client:<id>`・`grant:<ユーザー ID>:<id>`・
 * `token:<ユーザー ID>:<grant id>:<id>` など。値は JSON の文字列）
 */
export const oauthKvEntries = sqliteTable(
  "oauth_kv_entries",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    // この日時を過ぎた行は無いものとして扱い、定期実行で削除する。NULL は期限なし
    expiresAt: integer("expires_at", { mode: "timestamp" }),
  },
  (table) => [index("oauth_kv_entries_expires_at_idx").on(table.expiresAt)],
);

export type OAuthKvEntry = typeof oauthKvEntries.$inferSelect;
