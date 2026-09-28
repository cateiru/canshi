"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Collapsible, SegmentedControl } from "@/components/ui";
import { EXPENSE_CATEGORIES } from "@/db/schema";
import {
  EXPENSE_CHART_PERIOD_LABEL,
  type ExpenseChartMonth,
  type ExpenseChartPeriod,
  formatChartYearMonth,
  sliceByPeriod,
} from "./chart";
import styles from "./ExpenseChart.module.css";
import { EXPENSE_CATEGORY_COLOR, EXPENSE_CATEGORY_LABEL } from "./labels";

const ExpenseChartCanvas = dynamic(() => import("./ExpenseChartCanvas"), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

const PERIOD_ORDER: ExpenseChartPeriod[] = ["6m", "12m", "year"];

type ExpenseChartProps = {
  /** 古い順に並んだ月ごとの支出（表示期間の最大分） */
  months: ExpenseChartMonth[];
};

export function ExpenseChart({ months }: ExpenseChartProps) {
  const [period, setPeriod] = useState<ExpenseChartPeriod>("6m");

  const visibleMonths = useMemo(
    () => sliceByPeriod(months, period),
    [months, period],
  );
  const first = visibleMonths.at(0);
  const last = visibleMonths.at(-1);
  const hasExpenses = visibleMonths.some((month) => month.total > 0);

  return (
    <Collapsible title="月ごとの支出グラフ" defaultExpanded={false}>
      <div className={styles.header}>
        {first && last ? (
          <p className={styles.range}>
            {formatChartYearMonth(first)}〜{formatChartYearMonth(last)}
          </p>
        ) : null}
        <SegmentedControl
          size="sm"
          options={PERIOD_ORDER}
          labels={EXPENSE_CHART_PERIOD_LABEL}
          value={period}
          onChange={setPeriod}
          aria-label="表示期間"
        />
      </div>

      {hasExpenses ? (
        <>
          <div className={styles.canvas}>
            <ExpenseChartCanvas months={visibleMonths} />
          </div>
          <ul className={styles.legend} aria-label="カテゴリの凡例">
            {EXPENSE_CATEGORIES.map((category) => (
              <li key={category} className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{
                    backgroundColor: EXPENSE_CATEGORY_COLOR[category],
                  }}
                  aria-hidden="true"
                />
                {EXPENSE_CATEGORY_LABEL[category]}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className={styles.emptyPeriod}>この期間の支出はありません。</div>
      )}
    </Collapsible>
  );
}
