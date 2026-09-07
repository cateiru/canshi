import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { foodProducts } from "./food-products";

/**
 * 複数のごはん商品を組み合わせた「1回の食事」のプリセット。
 * 商品と同様に猫に紐付かない共有データ（どの猫にも使い回せる）。
 */
export const feedingPresets = sqliteTable("feeding_presets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type FeedingPreset = typeof feedingPresets.$inferSelect;
export type NewFeedingPreset = typeof feedingPresets.$inferInsert;

export const feedingPresetItems = sqliteTable("feeding_preset_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  presetId: text("preset_id")
    .notNull()
    .references(() => feedingPresets.id),
  foodProductId: text("food_product_id")
    .notNull()
    .references(() => foodProducts.id),
  // フォーム自動入力用のデフォルトの与える量。残した量はプリセットには
  // 持たせない（記録のたびに実測する値のため）
  givenAmountG: real("given_amount_g").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type FeedingPresetItem = typeof feedingPresetItems.$inferSelect;
export type NewFeedingPresetItem = typeof feedingPresetItems.$inferInsert;
