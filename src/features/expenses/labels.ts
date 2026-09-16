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

const YEN_FORMATTER = new Intl.NumberFormat("ja-JP");

/** 「1,280円」の形式で金額を表示する */
export function formatYen(amountYen: number): string {
  return `${YEN_FORMATTER.format(amountYen)}円`;
}
