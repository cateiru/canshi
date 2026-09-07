import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { hospitalVisits } from "./hospital-visits";
import { symptoms } from "./symptoms";

/**
 * 服薬の予定・マスタ的な情報。実績は medication_doses に記録する。
 */
export const medications = sqliteTable("medications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  symptomId: text("symptom_id").references(() => symptoms.id),
  name: text("name").notNull(),
  doseAmount: text("dose_amount").notNull(),
  dosesPerDay: integer("doses_per_day").notNull(),
  // 服用開始日・終了予定日は時刻を持たないため ISO8601 の日付文字列（YYYY-MM-DD）で保持する
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  // 13（通院記録）で後付けした、処方元の通院記録への外部キー
  hospitalVisitId: text("hospital_visit_id").references(
    () => hospitalVisits.id,
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Medication = typeof medications.$inferSelect;
export type NewMedication = typeof medications.$inferInsert;
