import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { households } from "./households";

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
 * 支出記録。家計簿として月ごとの支出を集計するための記録で、支出は家（`household_id`）に
 * 属し、その家の猫で共通のため `cat_id` を持たない。関連する猫は同じ家の猫に限り、
 * `expense_record_cats` で多対多に紐付ける（`src/db/README.md` の「共通カラム規約」の例外）。
 * 病院代として紐付く通院記録は `expense_record_hospital_visits` で管理する
 */
export const expenseRecords = sqliteTable(
  "expense_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // 支出を管理する家。家に所属するユーザーだけがこの支出を参照・編集できる。
    // 家に紐付けられなかった導入前の支出は NULL のまま残り、どのユーザーからも見えない。
    // `scripts/link-household.mts` で家に紐付ける
    householdId: text("household_id").references(() => households.id),
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
  (table) => [
    index("expense_records_household_id_spent_at_idx").on(
      table.householdId,
      table.spentAt,
    ),
  ],
);

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseRecord = typeof expenseRecords.$inferSelect;
export type NewExpenseRecord = typeof expenseRecords.$inferInsert;
