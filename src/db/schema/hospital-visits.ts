import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { symptoms } from "./symptoms";

export const hospitalVisits = sqliteTable("hospital_visits", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  symptomId: text("symptom_id").references((): AnySQLiteColumn => symptoms.id),
  // 受診日時。タイムライン集約における代表の発生日時列（src/db/README.md 参照）
  visitedAt: integer("visited_at", { mode: "timestamp" }).notNull(),
  reason: text("reason").notNull(),
  diagnosis: text("diagnosis"),
  examinationResults: text("examination_results"),
  treatment: text("treatment"),
  nextVisitAt: integer("next_visit_at", { mode: "timestamp" }),
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type HospitalVisit = typeof hospitalVisits.$inferSelect;
export type NewHospitalVisit = typeof hospitalVisits.$inferInsert;
