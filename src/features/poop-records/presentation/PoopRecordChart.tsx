"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Collapsible, SegmentedControl } from "@/components/ui";
import {
  buildPoopChartWindow,
  POOP_CHART_PERIOD_LABEL,
  type PoopChartPeriod,
  type PoopChartPoint,
} from "./chart";
import styles from "./PoopRecordChart.module.css";

const PoopRecordChartCanvas = dynamic(() => import("./PoopRecordChartCanvas"), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

const PERIOD_ORDER: PoopChartPeriod[] = ["1w", "3m", "6m"];

type PoopRecordChartProps = {
  points: PoopChartPoint[];
  now: string;
};

export function PoopRecordChart({ points, now }: PoopRecordChartProps) {
  const [period, setPeriod] = useState<PoopChartPeriod>("1w");

  const chartWindow = useMemo(
    () => buildPoopChartWindow(points, period, new Date(now)),
    [points, period, now],
  );

  return (
    <Collapsible
      title="うんちの時間帯"
      defaultExpanded={false}
      storageKey="canshi:poop-chart-expanded"
      reserveExpandedSpace
    >
      <div className={styles.header}>
        <SegmentedControl
          size="sm"
          options={PERIOD_ORDER}
          labels={POOP_CHART_PERIOD_LABEL}
          value={period}
          onChange={setPeriod}
          aria-label="表示期間"
        />
      </div>

      {chartWindow.points.length === 0 ? (
        <div className={styles.emptyPeriod}>この期間の記録はありません。</div>
      ) : (
        <div className={styles.canvas}>
          <PoopRecordChartCanvas
            period={period}
            points={chartWindow.points}
            dayStartIsos={chartWindow.dayStartIsos}
            gridIndexes={chartWindow.gridIndexes}
            tickIndexes={chartWindow.tickIndexes}
          />
        </div>
      )}
    </Collapsible>
  );
}
