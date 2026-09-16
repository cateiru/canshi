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
  filterCalendarDataByYear,
  type HospitalVisitCalendarDatum,
  listCalendarYears,
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
};

export function HospitalVisitChart({ data }: HospitalVisitChartProps) {
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
    <Disclosure className={styles.container} defaultExpanded={false}>
      <Heading level={2} className={styles.heading}>
        <Button slot="trigger" className={styles.trigger}>
          <TbTriangleFilled
            aria-hidden="true"
            size={12}
            className={styles.caret}
          />
          <span className={styles.title}>通院日カレンダー</span>
        </Button>
      </Heading>

      <DisclosurePanel>
        <div className={styles.panelInner}>
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

          <div className={styles.scrollArea}>
            <div className={styles.canvas}>
              <HospitalVisitChartCanvas data={yearData} year={year} />
            </div>
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
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
