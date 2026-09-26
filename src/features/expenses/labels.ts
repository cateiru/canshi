import type { ExpenseCategory } from "@/db/schema";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: "ご飯",
  treat: "おやつ",
  hygiene: "衛生用品",
  toy: "おもちゃ",
  medicine: "薬",
  hospital: "病院",
  other: "その他",
};

/**
 * カテゴリごとの色。支出の積み上げ棒グラフと凡例で使う。
 * 積み上げ順が隣り合うカテゴリ同士は色相が離れるように割り当てる
 */
export const EXPENSE_CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  food: "var(--color-accent)",
  treat: "var(--color-warning)",
  hygiene: "var(--color-accent-cool)",
  toy: "var(--color-success)",
  medicine: "var(--color-info)",
  hospital: "var(--color-error)",
  other: "color-mix(in srgb, var(--color-ink) 35%, var(--color-bg))",
};

const YEN_FORMATTER = new Intl.NumberFormat("ja-JP");

/** 「1,280円」の形式で金額を表示する */
export function formatYen(amountYen: number): string {
  return `${YEN_FORMATTER.format(amountYen)}円`;
}
