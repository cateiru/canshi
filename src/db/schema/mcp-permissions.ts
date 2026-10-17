import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * AI との接続（MCP）から読み取れる範囲。ユーザーごとに 1 行で、そのユーザーが許可した
 * すべての接続で共通に使う。行が無いユーザーは、すべての家・猫・記録を読み取れる。
 *
 * 後から作った家・登録した猫・追加した記録の種類も既定で読み取れるよう、許可した
 * ものではなく外したもの（拒否）を持つ（`src/features/mcp/permissions.ts` 参照）。
 * 家・猫は ID で持ち、外部キーにはしない。削除された家・猫の ID が残っても、
 * どの猫にも当てはまらなくなるだけで害はない
 */
export const mcpPermissions = sqliteTable("mcp_permissions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
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
});

export type McpPermissionsRow = typeof mcpPermissions.$inferSelect;
