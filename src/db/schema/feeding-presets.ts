import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { FEEDING_MODES, GIVEN_AMOUNT_LEVELS } from "./feeding-records";
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
  // プリセットを選んだときに記録フォームへ反映する記録方法（feeding_records.mode と同じ）
  mode: text("mode", { enum: FEEDING_MODES }).notNull().default("strict"),
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
  // 持たせない（記録のたびに実測する値のため）。厳格モードのプリセットでは
  // givenAmountG（グラム）、あいまいモードのプリセットでは givenAmountLevel（段階）を持つ
  givenAmountG: real("given_amount_g"),
  givenAmountLevel: text("given_amount_level", { enum: GIVEN_AMOUNT_LEVELS }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type FeedingPresetItem = typeof feedingPresetItems.$inferSelect;
export type NewFeedingPresetItem = typeof feedingPresetItems.$inferInsert;
