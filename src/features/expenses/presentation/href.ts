/** 一覧の絞り込み。`all` はすべての支出、`cat` は表示中の猫に紐付く支出だけ */
export const EXPENSE_SCOPES = ["all", "cat"] as const;

export type ExpenseScope = (typeof EXPENSE_SCOPES)[number];

export function isExpenseScope(value: unknown): value is ExpenseScope {
  return (
    typeof value === "string" &&
    (EXPENSE_SCOPES as readonly string[]).includes(value)
  );
}

export type ExpensesHrefParams = {
  ym: string;
  scope: ExpenseScope;
};

export function buildExpensesHref(
  catId: string,
  params: ExpensesHrefParams,
): string {
  const searchParams = new URLSearchParams();
  searchParams.set("ym", params.ym);
  searchParams.set("scope", params.scope);
  return `/cats/${catId}/expenses?${searchParams.toString()}`;
}
