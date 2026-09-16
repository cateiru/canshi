"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { TbCalendarStats } from "react-icons/tb";
import {
  filterCalendarDataToRange,
  getLastYearRange,
  type HospitalVisitCalendarDatum,
} from "./chart";
import styles from "./HospitalVisitChart.module.css";
import { CALENDAR_COLORS } from "./labels";

const HospitalVisitChartCanvas = dynamic(
  () => import("./HospitalVisitChartCanvas"),
  {
    ssr: false,
    loading: () => <div className={styles.placeholder} aria-hidden="true" />,
  },
);

type HospitalVisitChartProps = {
  data: HospitalVisitCalendarDatum[];
  now: string;
};

export function HospitalVisitChart({ data, now }: HospitalVisitChartProps) {
  const range = useMemo(() => getLastYearRange(new Date(now)), [now]);

  const rangeData = useMemo(
    () => filterCalendarDataToRange(data, range),
    [data, range],
  );

  if (data.length === 0) {
    return null;
  }

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <TbCalendarStats
            aria-hidden="true"
            size={20}
            className={styles.titleIcon}
          />
          通院日カレンダー
        </h2>
      </div>

      <section
        className={styles.canvas}
        aria-label="通院日カレンダーグラフ"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: 横スクロールするカレンダーをキーボードでも操作できるようにする
        tabIndex={0}
      >
        <HospitalVisitChartCanvas
          data={rangeData}
          from={range.from}
          to={range.to}
        />
      </section>

      <div className={styles.legend}>
        少ない
        <span className={styles.legendSwatches} aria-hidden="true">
          {CALENDAR_COLORS.map((color) => (
            <span
              key={color}
              className={styles.legendSwatch}
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        多い
      </div>
    </section>
  );
}
