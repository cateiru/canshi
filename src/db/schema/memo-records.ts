import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

export const memoRecords = sqliteTable(
  "memo_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
    // 日付を残さないメモは null。null のメモはタイムラインに載せない
    recordedAt: integer("recorded_at", { mode: "timestamp" }),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // 猫ごとの一覧を新しい順に読むため
    index("memo_records_cat_id_recorded_at_idx").on(
      table.catId,
      table.recordedAt,
    ),
  ],
);

export type MemoRecord = typeof memoRecords.$inferSelect;
export type NewMemoRecord = typeof memoRecords.$inferInsert;
