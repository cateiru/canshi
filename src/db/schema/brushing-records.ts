import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";

/** 抜け毛の量（主観）。少ない・いつも通り・多い */
export const BRUSHING_SHED_AMOUNTS = ["less", "usual", "more"] as const;

export type BrushingShedAmount = (typeof BRUSHING_SHED_AMOUNTS)[number];

export const brushingRecords = sqliteTable(
  "brushing_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
    performedAt: integer("performed_at", { mode: "timestamp" }).notNull(),
    // ブラッシングにかけた時間（分）。未入力は null
    durationMinutes: integer("duration_minutes"),
    shedAmount: text("shed_amount", { enum: BRUSHING_SHED_AMOUNTS }),
    hasMats: integer("has_mats", { mode: "boolean" }).notNull().default(false),
    hasSkinIssue: integer("has_skin_issue", { mode: "boolean" })
      .notNull()
      .default(false),
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
    index("brushing_records_cat_id_performed_at_idx").on(
      table.catId,
      table.performedAt,
    ),
  ],
);

export type BrushingRecord = typeof brushingRecords.$inferSelect;
export type NewBrushingRecord = typeof brushingRecords.$inferInsert;
