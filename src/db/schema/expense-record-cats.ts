import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { cats } from "./cats";
import { expenseRecords } from "./expense-records";

/**
 * 支出記録と猫の多対多の紐付け。猫のタイムラインや「{猫名}のみ」の絞り込みに使う。
 * 紐付けが 0 件の支出記録も「どの猫にも紐付かない共通の支出」として許容する
 */
export const expenseRecordCats = sqliteTable(
  "expense_record_cats",
  {
    expenseRecordId: text("expense_record_id")
      .notNull()
      .references(() => expenseRecords.id),
    catId: text("cat_id")
      .notNull()
      .references(() => cats.id),
  },
  (table) => [
    primaryKey({ columns: [table.expenseRecordId, table.catId] }),
    index("expense_record_cats_cat_id_idx").on(table.catId),
  ],
);

export type ExpenseRecordCat = typeof expenseRecordCats.$inferSelect;
export type NewExpenseRecordCat = typeof expenseRecordCats.$inferInsert;
