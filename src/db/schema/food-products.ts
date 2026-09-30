import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * ごはん商品のマスタデータ。猫に紐付かない共有データのため `cat_id` は持たない。
 */
export const foodProducts = sqliteTable("food_products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
});

export type FoodProduct = typeof foodProducts.$inferSelect;
export type NewFoodProduct = typeof foodProducts.$inferInsert;
