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
 * 削除された家・猫の ID が残っても、どの猫にも当てはまらなくなるだけで害はない。
 *
 * 記録の書き込み（追加・編集）と、家のごはん商品・プリセットの操作、共通のごはん商品の操作は、
 * 読み取りとは逆に許可したもの（`writable_record_types`・`household_operations`・
 * `catalog_operations`）だけを持つ。後から登録した猫・参加した家には書き込めず、
 * 行が無い接続はどれも行えない
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
    // 猫の ID ごとに、書き込み（追加・編集）を許可した記録の種類。読み取りも許可している
    // 種類だけが書き込める
    writableRecordTypes: text("writable_record_types", { mode: "json" })
      .$type<Record<string, string[]>>()
      .notNull()
      .default(sql`'{}'`),
    // 家の ID ごとに、許可したごはん商品・プリセットの操作（`MCP_HOUSEHOLD_OPERATIONS`）
    householdOperations: text("household_operations", { mode: "json" })
      .$type<Record<string, string[]>>()
      .notNull()
      .default(sql`'{}'`),
    // 許可した共通のごはん商品の操作（`MCP_CATALOG_OPERATIONS`）。アプリ全体の権限が admin の
    // ユーザーだけが許可でき、admin でなくなったユーザーの接続では、許可していても行えない
    catalogOperations: text("catalog_operations", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.clientId] })],
);

export type McpPermissionsRow = typeof mcpPermissions.$inferSelect;
