import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { mediaAssets } from "./media-assets";

/**
 * アプリの利用者。Cloudflare Access の OIDC でログインし、ID トークンのメールアドレス（`email`）で
 * 同じユーザーかを判定する（`src/features/auth/infrastructure/users.ts`）。
 * メールアドレスは画面には表示せず、本人も変えられない（変更はお問い合わせで受け、
 * `pnpm user:link-email` で行う）
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  // ログインに使うメールアドレス（`normalizeEmail` で正規化した値）。同じユーザーかの判定はこの値で行う。
  // 以前はハッシュ（`email_hash`）で保存していたため、移行の前からのユーザーのために NULL を許している
  // （#593。全員分をそろえてから `email_hash` を削除した）
  email: text("email").unique(),
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
