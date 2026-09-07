import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { foodProducts } from "./food-products";

export const feedingRecords = sqliteTable("feeding_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  foodProductId: text("food_product_id")
    .notNull()
    .references(() => foodProducts.id),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  givenAmountG: real("given_amount_g").notNull(),
  leftoverAmountG: real("leftover_amount_g").notNull(),
  // 商品のカロリー改定後も過去記録の値が変わらないよう、保存時に計算した値を保持する
  estimatedIntakeG: real("estimated_intake_g").notNull(),
  estimatedKcal: real("estimated_kcal").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type FeedingRecord = typeof feedingRecords.$inferSelect;
export type NewFeedingRecord = typeof feedingRecords.$inferInsert;
