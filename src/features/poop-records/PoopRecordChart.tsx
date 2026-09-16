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
import { TbTriangleFilled } from "react-icons/tb";
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
    <Disclosure className={styles.container} defaultExpanded={false}>
      <Heading level={2} className={styles.heading}>
        <Button slot="trigger" className={styles.trigger}>
          <TbTriangleFilled
            aria-hidden="true"
            size={12}
            className={styles.caret}
          />
          <span className={styles.title}>うんちの時間帯</span>
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
                  setPeriod(next as PoopChartPeriod);
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
                  {POOP_CHART_PERIOD_LABEL[value]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.emptyPeriod}>
              この期間の記録はありません。
            </div>
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
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
