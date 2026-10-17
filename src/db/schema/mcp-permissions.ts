import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * AI との接続（MCP）から読み取れる範囲。ユーザーが許可した接続（OAuth のクライアント）
 * ごとに 1 行で、行が無い接続は、すべての家・猫・記録を読み取れる。
 *
 * 接続は OAuth のクライアントの ID で見分ける。同じユーザーが同じクライアントに
 * もう一度同意すると、ライブラリが古い grant を解除するため、クライアントの ID ごとの
 * grant は 1 つになる（`src/features/mcp/permissions.ts` 参照）。クライアントは
 * `oauth_kv_entries` に保存されているため外部キーにはしない。
 *
 * 後から作った家・登録した猫・追加した記録の種類も既定で読み取れるよう、許可した
 * ものではなく外したもの（拒否）を持つ。家・猫は ID で持ち、外部キーにはしない。
 * 削除された家・猫の ID が残っても、どの猫にも当てはまらなくなるだけで害はない
 */
export const mcpPermissions = sqliteTable(
  "mcp_permissions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // OAuth のクライアントの ID（`client:{clientId}` の clientId）
    clientId: text("client_id").notNull(),
    // 外した家の ID。その家の猫は、猫ごとの設定にかかわらず読み取れない
    excludedHouseholdIds: text("excluded_household_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    // 外した猫の ID。プロフィールも記録も読み取れない
    excludedCatIds: text("excluded_cat_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    // 猫の ID ごとに、外した記録の種類（`MCP_PERMISSION_RECORD_TYPES`）
    excludedRecordTypes: text("excluded_record_types", { mode: "json" })
      .$type<Record<string, string[]>>()
      .notNull()
      .default(sql`'{}'`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.clientId] })],
);

export type McpPermissionsRow = typeof mcpPermissions.$inferSelect;
