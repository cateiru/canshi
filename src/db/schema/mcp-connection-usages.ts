import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * AI との接続（MCP）を最後に使った日時。設定の「AIとの接続」に表示する。ユーザーが
 * 許可した接続（OAuth のクライアント）ごとに 1 行で、`/mcp` へのリクエストのたびに
 * 更新する（`src/features/mcp/usages.ts`）。この機能の導入前から使っている接続や、
 * 接続してからまだ使っていない接続には行が無い。
 *
 * `mcp_permissions` と同じく、接続は grant ではなく OAuth のクライアントの ID で見分ける。
 * grant の ID で持つと、同じクライアントにもう一度同意してライブラリが古い grant を
 * 解除したときに、古い grant の行が残り続けるため。その場合は前の grant の日時が残るため、
 * 接続した日時より前の値は表示しない。クライアントは `oauth_kv_entries` に
 * 保存されているため外部キーにはしない
 */
export const mcpConnectionUsages = sqliteTable(
  "mcp_connection_usages",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // OAuth のクライアントの ID（`client:{clientId}` の clientId）
    clientId: text("client_id").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.clientId] })],
);

export type McpConnectionUsagesRow = typeof mcpConnectionUsages.$inferSelect;
