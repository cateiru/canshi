import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const vomitRecords = sqliteTable("vomit_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  count: integer("count").notNull(),
  amount: text("amount"),
  color: text("color"),
  hasBlood: integer("has_blood", { mode: "boolean" }).notNull().default(false),
  hasForeignObject: integer("has_foreign_object", { mode: "boolean" })
    .notNull()
    .default(false),
  appetiteNote: text("appetite_note"),
  energyNote: text("energy_note"),
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type VomitRecord = typeof vomitRecords.$inferSelect;
export type NewVomitRecord = typeof vomitRecords.$inferInsert;
