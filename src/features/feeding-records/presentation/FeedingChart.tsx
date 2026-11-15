"use client";

import dynamic from "next/dynamic";
import { type ComponentType, useMemo, useState } from "react";
import type { IconBaseProps } from "react-icons";
import { Collapsible, SegmentedControl } from "@/components/ui";
import {
  CalorieIcon,
  FeedingIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import {
  FEEDING_CHART_METRIC_LABEL,
  FEEDING_CHART_PERIOD_LABEL,
  type FeedingChartMetric,
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

const METRIC_ORDER: FeedingChartMetric[] = ["intake", "kcal"];

const METRIC_ICON: Record<FeedingChartMetric, ComponentType<IconBaseProps>> = {
  intake: FeedingIcon,
  kcal: CalorieIcon,
};

type FeedingChartProps = {
  points: FeedingChartPoint[];
  now: string;
};

export function FeedingChart({ points, now }: FeedingChartProps) {
  const [period, setPeriod] = useState<FeedingChartPeriod>("3m");
  // 食べた量とカロリーはほぼ同じ形のグラフになるため、並べずに切り替えて 1 つだけ表示する
  const [metric, setMetric] = useState<FeedingChartMetric>("intake");

  const filtered = useMemo(
    () => filterByPeriod(points, period, new Date(now)),
    [points, period, now],
  );

  return (
    <Collapsible
      title="ごはんの推移"
      defaultExpanded={false}
      storageKey="canshi:feeding-chart-expanded"
      reserveExpandedSpace
    >
      <div className={styles.header}>
        <SegmentedControl
          size="sm"
          options={METRIC_ORDER}
          labels={FEEDING_CHART_METRIC_LABEL}
          value={metric}
          onChange={setMetric}
          aria-label="グラフの種類"
        />
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
        <>
          <h3 className={styles.chartLabel}>
            <ScaledIcon
              icon={METRIC_ICON[metric]}
              aria-hidden="true"
              size={16}
            />
            {FEEDING_CHART_METRIC_LABEL[metric]}（推定）
          </h3>
          <div className={styles.canvas}>
            <FeedingChartCanvas
              points={filtered}
              allPoints={points}
              metric={metric}
            />
          </div>
        </>
      )}
    </Collapsible>
  );
}
