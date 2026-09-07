import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const poopRecords = sqliteTable("poop_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  amount: text("amount"),
  color: text("color"),
  consistency: text("consistency", {
    enum: ["hard", "normal", "soft", "liquid"],
  }).notNull(),
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

export type PoopRecord = typeof poopRecords.$inferSelect;
export type NewPoopRecord = typeof poopRecords.$inferInsert;
