import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { mediaAssets } from "./media-assets";

/**
 * アプリの利用者。現時点では認証を持たず、`/login` のログインボタンで
 * 先頭のユーザーを使う（いなければ作る）ため、常に 1 件以上存在する前提
 * （`src/features/auth/users.ts`）
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
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
