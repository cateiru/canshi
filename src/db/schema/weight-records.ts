import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const weightRecords = sqliteTable(
  "weight_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    inputMethod: text("input_method", { enum: ["auto", "direct"] }).notNull(),
    combinedWeightKg: real("combined_weight_kg"),
    humanWeightKg: real("human_weight_kg"),
    // 入力方法によらず最終的な猫の体重を保持する。自動算出時は combined - human を保存時に計算する
    catWeightKg: real("cat_weight_kg").notNull(),
    // ボディコンディションスコア（1〜5 の 5 段階、3 が理想体重）。未評価の記録は NULL
    bcs: integer("bcs"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // 猫ごとの一覧を新しい順に読むため
    index("weight_records_cat_id_occurred_at_idx").on(
      table.catId,
      table.occurredAt,
    ),
  ],
);

export type WeightRecord = typeof weightRecords.$inferSelect;
export type NewWeightRecord = typeof weightRecords.$inferInsert;
