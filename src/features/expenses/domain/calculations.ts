import type { ExpenseCategory } from "@/db/schema";
import { EXPENSE_CATEGORIES } from "@/db/schema";

export type ExpenseAmount = {
  amountYen: number;
  category: ExpenseCategory;
};

/** 支出の合計金額（円）を求める */
export function sumExpenseAmounts(expenses: readonly ExpenseAmount[]): number {
  return expenses.reduce((total, expense) => total + expense.amountYen, 0);
}

export type ExpenseCategoryTotal = {
  category: ExpenseCategory;
  amountYen: number;
};

/**
 * カテゴリごとの合計金額を、金額の多い順に返す。
 * 支出が 1 件もないカテゴリは含めない
 */
export function sumExpenseAmountsByCategory(
  expenses: readonly ExpenseAmount[],
): ExpenseCategoryTotal[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    totals.set(
      expense.category,
      (totals.get(expense.category) ?? 0) + expense.amountYen,
    );
  }

  return [...totals.entries()]
    .map(([category, amountYen]) => ({ category, amountYen }))
    .sort((a, b) => {
      const byAmount = b.amountYen - a.amountYen;
      // 金額が同じカテゴリの並びが読み出しごとに変わらないよう、
      // EXPENSE_CATEGORIES の定義順を tie-breaker にする
      return byAmount !== 0
        ? byAmount
        : EXPENSE_CATEGORIES.indexOf(a.category) -
            EXPENSE_CATEGORIES.indexOf(b.category);
    });
}
