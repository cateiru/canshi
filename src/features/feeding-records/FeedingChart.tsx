"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Button,
  Disclosure,
  DisclosurePanel,
  Heading,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { TbFlame, TbTriangleFilled } from "react-icons/tb";
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
    <Disclosure className={styles.container} defaultExpanded={false}>
      <Heading level={2} className={styles.heading}>
        <Button slot="trigger" className={styles.trigger}>
          <TbTriangleFilled
            aria-hidden="true"
            size={12}
            className={styles.caret}
          />
          <span className={styles.title}>ごはんの推移</span>
        </Button>
      </Heading>

      <DisclosurePanel>
        <div className={styles.panelInner}>
          <div className={styles.header}>
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
            <div className={styles.emptyPeriod}>
              この期間の記録はありません。
            </div>
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
                  <TbFlame aria-hidden="true" size={16} />
                  カロリー（推定）
                </h3>
                <div className={styles.canvas}>
                  <FeedingChartCanvas points={filtered} metric="kcal" />
                </div>
              </div>
            </div>
          )}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
