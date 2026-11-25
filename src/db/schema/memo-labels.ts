import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { households } from "./households";
import { memoRecords } from "./memo-records";

/** メモのラベルの色。値の見た目は tokens.css の `--color-label-*` で決める */
export const MEMO_LABEL_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;

export type MemoLabelColor = (typeof MEMO_LABEL_COLORS)[number];

/**
 * メモに付けるラベル。家（`household_id`）に属し、その家のどの猫のメモにも使い回せる。
 * 1 つのメモに複数のラベルを付けられる（`memo_record_labels`）
 */
export const memoLabels = sqliteTable(
  "memo_labels",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // ラベルを管理する家。家に所属するユーザーだけがこのラベルを参照・編集できる。登録後に家は変えられない
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    name: text("name").notNull(),
    color: text("color", { enum: MEMO_LABEL_COLORS }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // 同じ家に同じ名前のラベルを 2 つ作らないため（家ごとの一覧を読むインデックスを兼ねる）
    uniqueIndex("memo_labels_household_id_name_unique").on(
      table.householdId,
      table.name,
    ),
  ],
);

export type MemoLabel = typeof memoLabels.$inferSelect;
export type NewMemoLabel = typeof memoLabels.$inferInsert;

/**
 * メモとラベルの多対多の紐付け。メモの中身として持つため、メモを論理削除しても消さずに残す
 * （ラベルを削除するときに、削除済みのメモの分だけを消す）
 */
export const memoRecordLabels = sqliteTable(
  "memo_record_labels",
  {
    memoRecordId: text("memo_record_id")
      .notNull()
      .references(() => memoRecords.id),
    memoLabelId: text("memo_label_id")
      .notNull()
      .references(() => memoLabels.id),
  },
  (table) => [
    primaryKey({ columns: [table.memoRecordId, table.memoLabelId] }),
    // ラベルが付いたメモを数える・絞り込むため
    index("memo_record_labels_memo_label_id_idx").on(table.memoLabelId),
  ],
);

export type MemoRecordLabel = typeof memoRecordLabels.$inferSelect;
export type NewMemoRecordLabel = typeof memoRecordLabels.$inferInsert;
