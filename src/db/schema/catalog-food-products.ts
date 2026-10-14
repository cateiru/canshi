import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { FoodProductLifeStage } from "./food-products";

/**
 * 共通のごはん商品。管理画面（`packages/admin`）から登録し、どの家のユーザーからも
 * 検索できる。家に追加するときは `food_products` へ内容を写し、追加した後は家ごとに
 * 自由に編集できる（共通のごはん商品やほかの家の商品には影響しない）。
 * 列は `food_products` から家（`household_id`）を除いたもの
 */
export const catalogFoodProducts = sqliteTable(
  "catalog_food_products",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    /** メーカー名。NULL は未入力 */
    manufacturer: text("manufacturer"),
    kcalPer100g: real("kcal_per_100g").notNull(),
    /** 内容量（g）。`packageUnit` があるときは 1 単位あたり、ないときは商品全体の内容量 */
    packageAmountG: real("package_amount_g").notNull(),
    /** 内容量の単位（`本`・`袋`・`パック` など）。NULL は商品全体の内容量を表す */
    packageUnit: text("package_unit"),
    nutritionType: text("nutrition_type", {
      enum: ["complete", "general"],
    }).notNull(),
    textureType: text("texture_type", {
      enum: ["dry", "wet", "soup"],
    }).notNull(),
    /** 対象の猫（ライフステージ）の JSON 配列。空配列は未設定 */
    lifeStages: text("life_stages", { mode: "json" })
      .$type<FoodProductLifeStage[]>()
      .notNull()
      .default(sql`'[]'`),
    /** 対象の猫種（`cats.breed` と同じ表記）。NULL はすべての猫種を表す */
    targetBreed: text("target_breed"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // 検索結果をメーカー名・商品名の順に並べるため
    index("catalog_food_products_manufacturer_name_idx").on(
      table.manufacturer,
      table.name,
    ),
  ],
);

export type CatalogFoodProduct = typeof catalogFoodProducts.$inferSelect;
export type NewCatalogFoodProduct = typeof catalogFoodProducts.$inferInsert;
