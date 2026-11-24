import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { accessPermissionColumns } from "./access-permission-columns";
import { users } from "./users";

/**
 * AI との接続（MCP）から読み取れる範囲。ユーザーが許可した接続（OAuth のクライアント）
 * ごとに 1 行で、行が無い接続は、すべての家・猫・記録を読み取れる。
 *
 * 接続は OAuth のクライアントの ID で見分ける。同じユーザーが同じクライアントに
 * もう一度同意すると、ライブラリが古い grant を解除するため、クライアントの ID ごとの
 * grant は 1 つになる（`src/features/mcp/infrastructure/permissions.ts` 参照）。クライアントは
 * `oauth_kv_entries` に保存されているため外部キーにはしない。
 *
 * 許可した範囲の列は API トークン（`api_tokens`）と共通（`accessPermissionColumns`）。行が無い接続は、
 * 書き込みと操作はどれも行えない
 */
export const mcpPermissions = sqliteTable(
  "mcp_permissions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // OAuth のクライアントの ID（`client:{clientId}` の clientId）
    clientId: text("client_id").notNull(),
    ...accessPermissionColumns(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.clientId] })],
);

export type McpPermissionsRow = typeof mcpPermissions.$inferSelect;
