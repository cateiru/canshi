import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { households } from "./households";

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
    kcalPer100g: real("kcal_per_100g").notNull(),
    /** 内容量（g）。`packageUnit` があるときは 1 単位あたり、ないときは商品全体の内容量 */
    packageAmountG: real("package_amount_g").notNull(),
    /** 内容量の単位（`本`・`袋`・`パック` など）。NULL は商品全体の内容量を表す */
    packageUnit: text("package_unit"),
    nutritionType: text("nutrition_type", {
      enum: ["complete", "general"],
    }).notNull(),
    textureType: text("texture_type", { enum: ["dry", "wet"] }).notNull(),
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
  ],
);

export type FoodProduct = typeof foodProducts.$inferSelect;
export type NewFoodProduct = typeof foodProducts.$inferInsert;
