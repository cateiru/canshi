import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const shampooRecords = sqliteTable(
  "shampoo_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
    performedAt: integer("performed_at", { mode: "timestamp" }).notNull(),
    memo: text("memo"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // 猫ごとの一覧を新しい順に読むため
    index("shampoo_records_cat_id_performed_at_idx").on(
      table.catId,
      table.performedAt,
    ),
  ],
);

export type ShampooRecord = typeof shampooRecords.$inferSelect;
export type NewShampooRecord = typeof shampooRecords.$inferInsert;
