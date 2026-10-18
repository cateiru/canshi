import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * AI との接続（MCP）を最後に使った日時。設定の「AIとの接続」に表示する。ユーザーが
 * 同意した接続（OAuth の grant）ごとに 1 行で、`/mcp` へのリクエストのたびに
 * 更新する（`src/features/mcp/usages.ts`）。この機能の導入前から使っている接続や、
 * 接続してからまだ使っていない接続には行が無い。
 *
 * 一覧に表示する接続と同じく grant の ID で見分ける。クライアントの ID では、
 * ライブラリが同じクライアントの grant を複数残す場合（CIMD のクライアントで
 * 認可コードの渡し先が違う場合など）に、別の接続の日時が混ざるため。grant は
 * `oauth_kv_entries` に保存されているため外部キーにはせず、grant が無くなった行は
 * 定期実行で削除する
 */
export const mcpConnectionUsages = sqliteTable(
  "mcp_connection_usages",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // OAuth の grant の ID（`grant:{userId}:{grantId}` の grantId）
    grantId: text("grant_id").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.grantId] })],
);

export type McpConnectionUsagesRow = typeof mcpConnectionUsages.$inferSelect;
