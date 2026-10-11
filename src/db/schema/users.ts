import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { mediaAssets } from "./media-assets";

/**
 * アプリの利用者。Cloudflare Access の OIDC でログインし、ID トークンのメールアドレスを
 * ハッシュにした値（`email_hash`）で同じユーザーかを判定する（`src/features/auth/users.ts`）。
 * 個人情報をできるだけ持たないため、メールアドレスそのものは保存しない
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  // ログインに使うメールアドレスを、環境変数の SALT を使って argon2id でハッシュにした値
  // （`src/features/auth/emailHash.ts`）。メールアドレスによる同一ユーザーの判定はこの値で行う。
  // OIDC の導入前に作られたユーザーは、`pnpm user:link-email` で紐付けるまで NULL
  emailHash: text("email_hash").unique(),
  // アプリ全体の権限。家の中での権限（household_members.role）とは別
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  // アイコン画像（media_assets、record_type = "user_icon"）。users ⇄ media_assets が互いを参照するため
  // AnySQLiteColumn で型の循環参照を回避する
  iconMediaAssetId: text("icon_media_asset_id").references(
    (): AnySQLiteColumn => mediaAssets.id,
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
