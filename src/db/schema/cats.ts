import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  real,
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
  breed: text("breed"),
  adoptedAt: text("adopted_at"),
  // プロフィール画像として使う写真（media_assets）。cats ⇄ media_assets が互いを参照するため
  // AnySQLiteColumn で型の循環参照を回避する
  profileMediaAssetId: text("profile_media_asset_id").references(
    (): AnySQLiteColumn => mediaAssets.id,
  ),
  // true の間は写真を追加しても自動更新しない
  isProfilePinned: integer("is_profile_pinned", { mode: "boolean" })
    .notNull()
    .default(false),
  // プロフィール画像の表示位置（枠のサイズに対する百分率オフセット。0 が中央）。
  // 未設定（null）なら中央（0, 0）として扱う
  profileCropX: real("profile_crop_x"),
  profileCropY: real("profile_crop_y"),
  // プロフィール画像のズーム倍率（1 以上。1 = ズームなし）。未設定（null）なら 1 として扱う
  profileCropZoom: real("profile_crop_zoom"),
  // プロフィール画像の回転角度（度）。未設定（null）なら 0 として扱う
  profileCropRotation: real("profile_crop_rotation"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Cat = typeof cats.$inferSelect;
export type NewCat = typeof cats.$inferInsert;
