import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/sqlite-core";

/**
 * 外部接続（AI との接続・API トークン）に許可した範囲の列（`AccessPermissions`、
 * `src/features/external-access/domain/permissionRules.ts`）。
 * `mcp_permissions`・`api_tokens` で同じ列を持つ。
 *
 * 後から作った家・登録した猫・追加した記録の種類も既定で読み取れるよう、許可した
 * ものではなく外したもの（拒否）を持つ。家・猫は ID で持ち、外部キーにはしない。
 * 削除された家・猫の ID が残っても、どの猫にも当てはまらなくなるだけで害はない。
 *
 * 記録の書き込み（追加・編集）と、家ごとの操作（ごはん商品・プリセット・家・猫など）、
 * 共通のごはん商品の操作は、読み取りとは逆に許可したもの（`writable_record_types`・
 * `household_operations`・`catalog_operations`）だけを持つ。後から登録した猫・参加した家には書き込めない
 */
export function accessPermissionColumns() {
  return {
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
    // 猫の ID ごとに、外した記録の種類（`PERMISSION_RECORD_TYPES`）
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
    // 家の ID ごとに、許可した操作（`HOUSEHOLD_OPERATIONS`）
    householdOperations: text("household_operations", { mode: "json" })
      .$type<Record<string, string[]>>()
      .notNull()
      .default(sql`'{}'`),
    // 許可した共通のごはん商品の操作（`CATALOG_OPERATIONS`）。アプリ全体の権限が admin の
    // ユーザーだけが許可でき、admin でなくなったユーザーの接続・トークンでは、許可していても行えない
    catalogOperations: text("catalog_operations", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
  };
}
