"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { TbCalendarStats } from "react-icons/tb";
import styles from "./CleaningRecordChart.module.css";
import {
  CALENDAR_COLORS,
  type CleaningRecordCalendarDatum,
  filterCalendarDataToRange,
  getLastYearRange,
} from "./recordChart";

const CleaningRecordChartCanvas = dynamic(
  () => import("./CleaningRecordChartCanvas"),
  {
    ssr: false,
    loading: () => <div className={styles.placeholder} aria-hidden="true" />,
  },
);

type CleaningRecordChartProps = {
  data: CleaningRecordCalendarDatum[];
  now: string;
};

export function CleaningRecordChart({ data, now }: CleaningRecordChartProps) {
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
          実施日カレンダー
        </h2>
      </div>

      <section
        className={styles.canvas}
        aria-label="実施日カレンダーグラフ"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: 横スクロールするカレンダーをキーボードでも操作できるようにする
        tabIndex={0}
      >
        <CleaningRecordChartCanvas
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
