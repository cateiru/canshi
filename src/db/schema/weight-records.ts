import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const weightRecords = sqliteTable("weight_records", {
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type WeightRecord = typeof weightRecords.$inferSelect;
export type NewWeightRecord = typeof weightRecords.$inferInsert;
