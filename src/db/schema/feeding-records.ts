import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { foodProducts } from "./food-products";

/**
 * ごはん記録のヘッダー。1回の食事に複数の商品（ウェット＋カリカリなど）を
 * 組み合わせられるよう、商品ごとの量は `feedingRecordItems` に分離している。
 */
export const feedingRecords = sqliteTable("feeding_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type FeedingRecord = typeof feedingRecords.$inferSelect;
export type NewFeedingRecord = typeof feedingRecords.$inferInsert;

export const feedingRecordItems = sqliteTable("feeding_record_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  feedingRecordId: text("feeding_record_id")
    .notNull()
    .references(() => feedingRecords.id),
  foodProductId: text("food_product_id")
    .notNull()
    .references(() => foodProducts.id),
  givenAmountG: real("given_amount_g").notNull(),
  leftoverAmountG: real("leftover_amount_g").notNull(),
  // 商品のカロリー改定後も過去記録の値が変わらないよう、保存時に計算した値を保持する
  estimatedIntakeG: real("estimated_intake_g").notNull(),
  estimatedKcal: real("estimated_kcal").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type FeedingRecordItem = typeof feedingRecordItems.$inferSelect;
export type NewFeedingRecordItem = typeof feedingRecordItems.$inferInsert;
