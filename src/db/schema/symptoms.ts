import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { hospitalVisits } from "./hospital-visits";

export const symptoms = sqliteTable("symptoms", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  symptomType: text("symptom_type").notNull(),
  // 発症日時。タイムライン集約における代表の発生日時列（src/db/README.md 参照）
  onsetAt: integer("onset_at", { mode: "timestamp" }).notNull(),
  frequencyOrSeverity: text("frequency_or_severity"),
  appetiteNote: text("appetite_note"),
  energyNote: text("energy_note"),
  status: text("status", {
    enum: ["ongoing", "improving", "resolved"],
  }).notNull(),
  memo: text("memo"),
  // 13（通院記録）で後付けした、紐付く通院記録への外部キー
  hospitalVisitId: text("hospital_visit_id").references(
    (): AnySQLiteColumn => hospitalVisits.id,
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Symptom = typeof symptoms.$inferSelect;
export type NewSymptom = typeof symptoms.$inferInsert;
