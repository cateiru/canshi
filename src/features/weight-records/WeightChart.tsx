"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui";
import {
  filterByPeriod,
  WEIGHT_CHART_PERIOD_LABEL,
  type WeightChartPeriod,
  type WeightChartPoint,
} from "./chart";
import styles from "./WeightChart.module.css";

const WeightChartCanvas = dynamic(() => import("./WeightChartCanvas"), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

const PERIOD_ORDER: WeightChartPeriod[] = ["1m", "3m", "all"];

type WeightChartProps = {
  points: WeightChartPoint[];
  now: string;
};

export function WeightChart({ points, now }: WeightChartProps) {
  const [period, setPeriod] = useState<WeightChartPeriod>("3m");

  const filtered = useMemo(
    () => filterByPeriod(points, period, new Date(now)),
    [points, period, now],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>体重の推移</h2>
        <SegmentedControl
          size="sm"
          options={PERIOD_ORDER}
          labels={WEIGHT_CHART_PERIOD_LABEL}
          value={period}
          onChange={setPeriod}
          aria-label="表示期間"
        />
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyPeriod}>この期間の記録はありません。</div>
      ) : (
        <div className={styles.canvas}>
          <WeightChartCanvas points={filtered} />
        </div>
      )}
    </div>
  );
}
