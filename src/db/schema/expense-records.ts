import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { hospitalVisits } from "./hospital-visits";

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
 * で多対多に紐付ける（`src/db/README.md` の「共通カラム規約」の例外）
 */
export const expenseRecords = sqliteTable("expense_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // 支出日。タイムライン集約における代表の発生日時列（src/db/README.md 参照）。
  // フォームの入力は日付のみで、時刻は 00:00 として保存する
  spentAt: integer("spent_at", { mode: "timestamp" }).notNull(),
  amountYen: integer("amount_yen").notNull(),
  category: text("category", { enum: EXPENSE_CATEGORIES }).notNull(),
  // 通院記録で病院代として登録された支出の紐付け先。通院記録の削除時は
  // 参照だけ解除して支出記録自体は残す
  hospitalVisitId: text("hospital_visit_id").references(
    () => hospitalVisits.id,
  ),
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseRecord = typeof expenseRecords.$inferSelect;
export type NewExpenseRecord = typeof expenseRecords.$inferInsert;
