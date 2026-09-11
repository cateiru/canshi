import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const cleaningTargets = sqliteTable("cleaning_targets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  catId: text("cat_id")
    .notNull()
    .references(() => cats.id),
  name: text("name").notNull(),
  frequencyValue: integer("frequency_value").notNull(),
  frequencyUnit: text("frequency_unit", { enum: ["days", "months"] })
    .notNull()
    .default("days"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type CleaningTarget = typeof cleaningTargets.$inferSelect;
export type NewCleaningTarget = typeof cleaningTargets.$inferInsert;
