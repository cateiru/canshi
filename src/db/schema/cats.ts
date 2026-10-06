import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { households } from "./households";
import { mediaAssets } from "./media-assets";

export const cats = sqliteTable(
  "cats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // 猫を飼っている家。家に所属するユーザーだけがこの猫を参照・編集できる。
    // 家の導入前から登録されていた猫は NULL のまま残り、どのユーザーからも見えない。
    // `scripts/link-household.mts` で家に紐付ける
    householdId: text("household_id").references(() => households.id),
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
  },
  (table) => [index("cats_household_id_idx").on(table.householdId)],
);

export type Cat = typeof cats.$inferSelect;
export type NewCat = typeof cats.$inferInsert;
