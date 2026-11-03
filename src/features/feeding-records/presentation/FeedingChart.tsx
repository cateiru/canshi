"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Collapsible, SegmentedControl } from "@/components/ui";
import {
  CalorieIcon,
  FeedingIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import {
  FEEDING_CHART_PERIOD_LABEL,
  type FeedingChartPeriod,
  type FeedingChartPoint,
  filterByPeriod,
} from "./chart";
import styles from "./FeedingChart.module.css";

const FeedingChartCanvas = dynamic(() => import("./FeedingChartCanvas"), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

const PERIOD_ORDER: FeedingChartPeriod[] = ["1m", "3m", "all"];

type FeedingChartProps = {
  points: FeedingChartPoint[];
  now: string;
};

export function FeedingChart({ points, now }: FeedingChartProps) {
  const [period, setPeriod] = useState<FeedingChartPeriod>("3m");

  const filtered = useMemo(
    () => filterByPeriod(points, period, new Date(now)),
    [points, period, now],
  );

  return (
    <Collapsible title="ごはんの推移" defaultExpanded={false}>
      <div className={styles.header}>
        <SegmentedControl
          size="sm"
          options={PERIOD_ORDER}
          labels={FEEDING_CHART_PERIOD_LABEL}
          value={period}
          onChange={setPeriod}
          aria-label="表示期間"
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyPeriod}>この期間の記録はありません。</div>
      ) : (
        <div className={styles.charts}>
          <div className={styles.chartBlock}>
            <h3 className={styles.chartLabel}>
              <FeedingIcon aria-hidden="true" size={16} />
              食べた量（推定）
            </h3>
            <div className={styles.canvas}>
              <FeedingChartCanvas points={filtered} metric="intake" />
            </div>
          </div>
          <div className={styles.chartBlock}>
            <h3 className={styles.chartLabel}>
              <CalorieIcon aria-hidden="true" size={16} />
              カロリー（推定）
            </h3>
            <div className={styles.canvas}>
              <FeedingChartCanvas points={filtered} metric="kcal" />
            </div>
          </div>
        </div>
      )}
    </Collapsible>
  );
}
