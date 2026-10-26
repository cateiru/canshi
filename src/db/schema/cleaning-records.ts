import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { cleaningTargets } from "./cleaning-targets";

export const cleaningRecords = sqliteTable(
  "cleaning_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // cleaningTargetId 経由でも解決できるが、`03` の規約とタイムライン集約の統一のため保持する
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
    cleaningTargetId: text("cleaning_target_id")
      .notNull()
      .references(() => cleaningTargets.id),
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
    // 掃除対象ごとの一覧を新しい順に読むため
    index("cleaning_records_cleaning_target_id_performed_at_idx").on(
      table.cleaningTargetId,
      table.performedAt,
    ),
  ],
);

export type CleaningRecord = typeof cleaningRecords.$inferSelect;
export type NewCleaningRecord = typeof cleaningRecords.$inferInsert;
