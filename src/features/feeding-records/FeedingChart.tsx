"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { TbFlame } from "react-icons/tb";
import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>ごはんの推移</h2>
        <ToggleButtonGroup
          className={styles.periodGroup}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[period]}
          onSelectionChange={(keys) => {
            const [next] = keys;
            if (next) {
              setPeriod(next as FeedingChartPeriod);
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
              {FEEDING_CHART_PERIOD_LABEL[value]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyPeriod}>この期間の記録はありません。</div>
      ) : (
        <div className={styles.charts}>
          <div className={styles.chartBlock}>
            <h3 className={styles.chartLabel}>
              <FeedingIcon aria-hidden="true" size={16} />
              食べた量
            </h3>
            <div className={styles.canvas}>
              <FeedingChartCanvas points={filtered} metric="intake" />
            </div>
          </div>
          <div className={styles.chartBlock}>
            <h3 className={styles.chartLabel}>
              <TbFlame aria-hidden="true" size={16} />
              カロリー
            </h3>
            <div className={styles.canvas}>
              <FeedingChartCanvas points={filtered} metric="kcal" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
