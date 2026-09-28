"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Collapsible, SegmentedControl } from "@/components/ui";
import {
  filterByPeriod,
  POOP_CHART_PERIOD_LABEL,
  type PoopChartPeriod,
  type PoopChartPoint,
} from "./chart";
import {
  CONSISTENCY_COLOR,
  CONSISTENCY_LABEL,
  CONSISTENCY_ORDER,
} from "./labels";
import styles from "./PoopRecordChart.module.css";

const PoopRecordChartCanvas = dynamic(() => import("./PoopRecordChartCanvas"), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

const PERIOD_ORDER: PoopChartPeriod[] = ["1m", "3m", "all"];

type PoopRecordChartProps = {
  points: PoopChartPoint[];
  now: string;
};

export function PoopRecordChart({ points, now }: PoopRecordChartProps) {
  const [period, setPeriod] = useState<PoopChartPeriod>("3m");

  const filtered = useMemo(
    () => filterByPeriod(points, period, new Date(now)),
    [points, period, now],
  );

  return (
    <Collapsible title="うんちの時間帯" defaultExpanded={false}>
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

      {filtered.length === 0 ? (
        <div className={styles.emptyPeriod}>この期間の記録はありません。</div>
      ) : (
        <>
          <div className={styles.canvas}>
            <PoopRecordChartCanvas points={filtered} />
          </div>
          <ul className={styles.legend} aria-label="便の状態の凡例">
            {CONSISTENCY_ORDER.map((consistency) => (
              <li key={consistency} className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{
                    backgroundColor: CONSISTENCY_COLOR[consistency],
                  }}
                  aria-hidden="true"
                />
                {CONSISTENCY_LABEL[consistency]}
              </li>
            ))}
          </ul>
        </>
      )}
    </Collapsible>
  );
}
