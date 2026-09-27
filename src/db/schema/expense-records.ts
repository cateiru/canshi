import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const EXPENSE_CATEGORIES = [
  "food",
  "treat",
  "hygiene",
  "toy",
  "medicine",
  "hospital",
  "other",
] as const;

/**
 * 支出記録。家計簿として月ごとの支出を集計するための記録で、支出そのものは
 * すべての猫で共通のため `cat_id` を持たず、関連する猫は `expense_record_cats`
 * で多対多に紐付ける（`src/db/README.md` の「共通カラム規約」の例外）。
 * 病院代として紐付く通院記録は `expense_record_hospital_visits` で管理する
 */
export const expenseRecords = sqliteTable(
  "expense_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // 支出日。タイムライン集約における代表の発生日時列（src/db/README.md 参照）。
    // フォームの入力は日付のみで、時刻は 00:00 として保存する
    spentAt: integer("spent_at", { mode: "timestamp" }).notNull(),
    amountYen: integer("amount_yen").notNull(),
    category: text("category", { enum: EXPENSE_CATEGORIES }).notNull(),
    memo: text("memo"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("expense_records_spent_at_idx").on(table.spentAt)],
);

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseRecord = typeof expenseRecords.$inferSelect;
export type NewExpenseRecord = typeof expenseRecords.$inferInsert;
