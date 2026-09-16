"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { TbCalendarStats } from "react-icons/tb";
import styles from "./CleaningRecordChart.module.css";
import {
  CALENDAR_COLORS,
  type CleaningRecordCalendarDatum,
  filterCalendarDataByYear,
  listCalendarYears,
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
};

export function CleaningRecordChart({ data }: CleaningRecordChartProps) {
  const years = useMemo(() => listCalendarYears(data), [data]);
  const [year, setYear] = useState(years[0]);

  const yearData = useMemo(
    () => (year ? filterCalendarDataByYear(data, year) : []),
    [data, year],
  );

  if (!year) {
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

        {years.length > 1 ? (
          <ToggleButtonGroup
            className={styles.yearGroup}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[String(year)]}
            onSelectionChange={(keys) => {
              const [next] = keys;
              if (next) {
                setYear(Number(next));
              }
            }}
            aria-label="表示年"
          >
            {years.map((value) => (
              <ToggleButton
                key={value}
                id={String(value)}
                className={styles.yearButton}
              >
                {value}年
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        ) : (
          <span className={styles.yearLabel}>{year}年</span>
        )}
      </div>

      <section
        className={styles.canvas}
        aria-label="実施日カレンダーグラフ"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: 横スクロールするカレンダーをキーボードでも操作できるようにする
        tabIndex={0}
      >
        <CleaningRecordChartCanvas data={yearData} year={year} />
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
