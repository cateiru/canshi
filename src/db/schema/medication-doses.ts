import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { medications } from "./medications";

/**
 * 実際の投薬実績。`catId` は `medicationId` 経由でも解決できるが、
 * すべての記録テーブルが `cat_id` を持つ規約を守り、タイムライン集約を
 * 他の記録テーブルと同じ形（medications への JOIN 不要）で書けるようにするため保持する。
 */
export const medicationDoses = sqliteTable("medication_doses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  medicationId: text("medication_id")
    .notNull()
    .references(() => medications.id),
  // 実際に投薬した日時。タイムライン集約における代表の発生日時列（src/db/README.md 参照）
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  wasAdministered: integer("was_administered", { mode: "boolean" })
    .notNull()
    .default(true),
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type MedicationDose = typeof medicationDoses.$inferSelect;
export type NewMedicationDose = typeof medicationDoses.$inferInsert;
