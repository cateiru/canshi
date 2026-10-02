import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { mediaAssets } from "./media-assets";

export const cats = sqliteTable("cats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  sex: text("sex", { enum: ["male", "female", "unknown"] }).notNull(),
  // 生年月日・お迎え日は時刻を持たないため ISO8601 の日付文字列（YYYY-MM-DD）で保持する
  birthDate: text("birth_date"),
  // 生年月日のうち、わかっている範囲（年のみ・年月まで・年月日すべて）。年のみ・年月のみの場合、
  // birth_date の未入力部分は 1月・1日で補完して保存し、年齢や誕生日もその日付で扱う
  birthDatePrecision: text("birth_date_precision", {
    enum: ["year", "month", "day"],
  })
    .notNull()
    .default("day"),
  breed: text("breed"),
  adoptedAt: text("adopted_at"),
  // プロフィール画像（media_assets、record_type = "cat_profile"）。cats ⇄ media_assets が互いを参照するため
  // AnySQLiteColumn で型の循環参照を回避する
  profileMediaAssetId: text("profile_media_asset_id").references(
    (): AnySQLiteColumn => mediaAssets.id,
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Cat = typeof cats.$inferSelect;
export type NewCat = typeof cats.$inferInsert;
