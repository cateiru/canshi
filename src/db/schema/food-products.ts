import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { catalogFoodProducts } from "./catalog-food-products";
import { households } from "./households";

/** ごはん商品の対象の猫（キトン・成猫・シニア・療養） */
export const FOOD_PRODUCT_LIFE_STAGES = [
  "kitten",
  "adult",
  "senior",
  "care",
] as const;

export type FoodProductLifeStage = (typeof FOOD_PRODUCT_LIFE_STAGES)[number];

/**
 * ごはん商品のマスタデータ。家（`household_id`）に属し、その家の猫で共通のため
 * `cat_id` は持たない。
 */
export const foodProducts = sqliteTable(
  "food_products",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // 商品を管理する家。家に所属するユーザーだけがこの商品を参照・編集できる。
    // 家に紐付けられなかった導入前の商品は NULL のまま残り、どのユーザーからも見えない。
    // `scripts/link-household.mts` で家に紐付ける
    householdId: text("household_id").references(() => households.id),
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
    /**
     * 対象の猫（ライフステージ）の JSON 配列。複数を選べ、空配列は未設定を表す。
     * 検索では `json_each` で絞り込む
     */
    lifeStages: text("life_stages", { mode: "json" })
      .$type<FoodProductLifeStage[]>()
      .notNull()
      .default(sql`'[]'`),
    /** 対象の猫種（`cats.breed` と同じ表記）。NULL はすべての猫種を表す */
    targetBreed: text("target_breed"),
    // 共通のごはん商品から追加したときの追加元。検索結果で「追加済み」を表示するためだけに使い、
    // 追加した後の内容は共通のごはん商品と連動しない。手動で登録した商品と、追加元が
    // 管理画面で削除された商品は NULL
    catalogFoodProductId: text("catalog_food_product_id").references(
      () => catalogFoodProducts.id,
      { onDelete: "set null" },
    ),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("food_products_household_id_created_at_idx").on(
      table.householdId,
      table.createdAt,
    ),
    // 同じ共通のごはん商品を同じ家に 2 回追加しないため（同時に追加されても 1 件にする）。
    // 手動で登録した商品は追加元が NULL で、NULL 同士は重複とみなされない
    uniqueIndex("food_products_household_id_catalog_food_product_id_unique").on(
      table.householdId,
      table.catalogFoodProductId,
    ),
  ],
);

export type FoodProduct = typeof foodProducts.$inferSelect;
export type NewFoodProduct = typeof foodProducts.$inferInsert;
