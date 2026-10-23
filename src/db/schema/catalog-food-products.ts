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
 * 共通のごはん商品の内容量の候補。`unit` があるときは 1 単位あたり、ないときは商品全体の内容量
 * （`food_products` の `package_amount_g`・`package_unit` と同じ意味）
 */
export type CatalogPackageSize = {
  /** 内容量（g） */
  amountG: number;
  /** 内容量の単位（`本`・`袋`・`パック` など）。NULL は商品全体の内容量を表す */
  unit: string | null;
};

/**
 * 共通のごはん商品。管理画面（`packages/admin`）から登録し、どの家のユーザーからも
 * 検索できる。家に追加するときは `food_products` へ内容を写し、追加した後は家ごとに
 * 自由に編集できる（共通のごはん商品やほかの家の商品には影響しない）。
 * 列は `food_products` から家（`household_id`）を除き、内容量の候補（`package_sizes`）と
 * 検索キーワード（`search_keywords`）を足したもの
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
    /**
     * 先頭の内容量の候補の内容量（g）。`packageSizes` を追加する前のコードのために残し、
     * 管理画面は先頭の候補の値を書き続ける。古い管理画面がこの列だけを更新した場合も反映するため、
     * 先頭の候補はこの列から読む（`catalogPackageSizes`）
     */
    packageAmountG: real("package_amount_g").notNull(),
    /** 先頭の内容量の候補の単位（`packageAmountG` と同じく、追加する前のコードのために残す） */
    packageUnit: text("package_unit"),
    /**
     * 内容量の候補の JSON 配列（#346）。家に追加するときに 1 つ選び、管理画面で並べた順に表示する。
     * 先頭の候補は `packageAmountG`・`packageUnit` から読み、この列からは 2 件目以降だけを使う。
     * 候補を追加する前の管理画面で登録された商品は空配列になる
     * （`src/features/catalog-food-products/packageSizes.ts`）
     */
    packageSizes: text("package_sizes", { mode: "json" })
      .$type<CatalogPackageSize[]>()
      .notNull()
      .default(sql`'[]'`),
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
    /**
     * 検索キーワードの JSON 配列（#366）。商品名・メーカー名とは別の呼び方（「ちゅーる」など）でも
     * 検索で見つかるようにする。空配列は未設定。家に追加するときには写さない
     */
    searchKeywords: text("search_keywords", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
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
