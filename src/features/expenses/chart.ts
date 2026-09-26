import type { ExpenseCategory } from "@/db/schema";
import { EXPENSE_CATEGORIES } from "@/db/schema";
import { formatYm, shiftYm, type YearMonth } from "@/features/shared/yearMonth";

/** グラフ用に取得する月数（表示期間の最大値） */
export const EXPENSE_CHART_MAX_MONTHS = 12;

export type ExpenseChartPeriod = "6m" | "12m";

export const EXPENSE_CHART_PERIOD_LABEL: Record<ExpenseChartPeriod, string> = {
  "6m": "半年",
  "12m": "1年",
};

export const EXPENSE_CHART_PERIOD_MONTHS: Record<ExpenseChartPeriod, number> = {
  "6m": 6,
  "12m": EXPENSE_CHART_MAX_MONTHS,
};

/** 積み上げ棒グラフの 1 本（1 か月分）。クライアントへ渡すため Date は含めない */
export type ExpenseChartMonth = {
  ym: string;
  year: number;
  month: number; // 1-12
  amounts: Record<ExpenseCategory, number>;
  total: number;
};

type ExpenseChartSource = {
  spentAt: Date;
  category: ExpenseCategory;
  amountYen: number;
};

/** `end` 月を終端とした `months` か月分の範囲（両端の月を含む）を返す */
export function getExpenseChartRange(
  end: YearMonth,
  months: number = EXPENSE_CHART_MAX_MONTHS,
): { from: YearMonth; to: YearMonth } {
  return { from: shiftYm(end, -(months - 1)), to: end };
}

function emptyAmounts(): Record<ExpenseCategory, number> {
  return Object.fromEntries(
    EXPENSE_CATEGORIES.map((category) => [category, 0]),
  ) as Record<ExpenseCategory, number>;
}

/**
 * 支出を月・カテゴリごとに合計し、`end` 月を終端とした `months` か月分を
 * 古い順に返す。棒の位置がずれないよう支出のない月・カテゴリも 0 で埋める。
 * spentAt は datetime.ts の方針どおり入力した日付をそのまま UTC として
 * 保存した値なので、getUTC* でそのまま「入力された年月」を取り出せる
 */
export function buildMonthlyExpenseChart(
  expenses: readonly ExpenseChartSource[],
  end: YearMonth,
  months: number = EXPENSE_CHART_MAX_MONTHS,
): ExpenseChartMonth[] {
  const { from } = getExpenseChartRange(end, months);
  const result: ExpenseChartMonth[] = [];
  const byYm = new Map<string, ExpenseChartMonth>();
  for (let i = 0; i < months; i++) {
    const ym = shiftYm(from, i);
    const entry: ExpenseChartMonth = {
      ym: formatYm(ym),
      year: ym.year,
      month: ym.month,
      amounts: emptyAmounts(),
      total: 0,
    };
    result.push(entry);
    byYm.set(entry.ym, entry);
  }

  for (const expense of expenses) {
    const entry = byYm.get(
      formatYm({
        year: expense.spentAt.getUTCFullYear(),
        month: expense.spentAt.getUTCMonth() + 1,
      }),
    );
    if (entry == null) {
      continue;
    }
    entry.amounts[expense.category] += expense.amountYen;
    entry.total += expense.amountYen;
  }

  return result;
}

/** 表示期間に合わせて、終端の月から数えた直近の月だけを切り出す */
export function sliceByPeriod(
  months: readonly ExpenseChartMonth[],
  period: ExpenseChartPeriod,
): ExpenseChartMonth[] {
  return months.slice(-EXPENSE_CHART_PERIOD_MONTHS[period]);
}

/** 「2026年9月」の形式で年月を表示する */
export function formatChartYearMonth({
  year,
  month,
}: Pick<ExpenseChartMonth, "year" | "month">): string {
  return `${year}年${month}月`;
}
