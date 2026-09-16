"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
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
      <h2 className={styles.title}>実施日カレンダー</h2>

      {years.length > 1 && (
        <div className={styles.header}>
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
        </div>
      )}

      <div className={styles.canvas}>
        <CleaningRecordChartCanvas data={yearData} year={year} />
      </div>

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
