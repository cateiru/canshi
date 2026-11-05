import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const waterRecords = sqliteTable(
  "water_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    measurementMethod: text("measurement_method", {
      enum: ["measuring_cup", "scale", "visual"],
    }).notNull(),
    suppliedAmountMl: real("supplied_amount_ml").notNull(),
    remainingAmountMl: real("remaining_amount_ml"),
    // 残量が未入力の場合は計算しないため nullable。商品改定等の影響を受けないよう保存時に計算した値を保持する
    estimatedIntakeMl: real("estimated_intake_ml"),
    hasSpill: integer("has_spill", { mode: "boolean" })
      .notNull()
      .default(false),
    wasWaterChanged: integer("was_water_changed", { mode: "boolean" })
      .notNull()
      .default(false),
    subjectiveAmount: text("subjective_amount", {
      enum: ["more", "usual", "less"],
    }),
    memo: text("memo"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    // 記録を削除した日時。削除は論理削除で、NULL でない行は削除済みとして読み取り・更新から除く（猫・家を削除したときは物理削除する）
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    // 猫ごとの一覧を新しい順に読むため
    index("water_records_cat_id_occurred_at_idx").on(
      table.catId,
      table.occurredAt,
    ),
  ],
);

export type WaterRecord = typeof waterRecords.$inferSelect;
export type NewWaterRecord = typeof waterRecords.$inferInsert;
