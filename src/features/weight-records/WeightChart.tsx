"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
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
        <ToggleButtonGroup
          className={styles.periodGroup}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[period]}
          onSelectionChange={(keys) => {
            const [next] = keys;
            if (next) {
              setPeriod(next as WeightChartPeriod);
            }
          }}
          aria-label="表示期間"
        >
          {PERIOD_ORDER.map((value) => (
            <ToggleButton
              key={value}
              id={value}
              className={styles.periodButton}
            >
              {WEIGHT_CHART_PERIOD_LABEL[value]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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
