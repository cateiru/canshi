import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { accessPermissionColumns } from "./access-permission-columns";
import { users } from "./users";

/**
 * API（`/api/v1`）のトークン。トークンそのものは保存せず、そのハッシュ（SHA-256）を持つ
 * （`sessions`・`household_invitations` と同じ）ため、トークンを表示できるのは発行したときだけ。
 *
 * 読み取れる範囲・許可する操作は、AI との接続（`mcp_permissions`）と同じ形で持つ。トークンには
 * 必ず 1 つの範囲があるため、別のテーブルに分けない。発行した後から変えられる
 */
export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // ユーザーがトークンを見分けるための名前
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    // この日時を過ぎたトークンは使えない。NULL は期限なし。期限が切れた行も、ユーザーが削除するまで残す
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    ...accessPermissionColumns(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("api_tokens_user_id_idx").on(table.userId)],
);

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
