"use client";

import { ResponsiveTimeRange } from "@nivo/calendar";
import styles from "./CleaningRecordChart.module.css";
import {
  CALENDAR_COLORS,
  type CleaningRecordCalendarDatum,
} from "./recordChart";

type CleaningRecordChartCanvasProps = {
  data: CleaningRecordCalendarDatum[];
  year: number;
};

const nivoTheme = {
  text: {
    fill: "var(--color-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
  },
  tooltip: {
    container: {
      background: "var(--color-bg)",
      color: "var(--color-ink)",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
    },
  },
};

export default function CleaningRecordChartCanvas({
  data,
  year,
}: CleaningRecordChartCanvasProps) {
  return (
    <div className={styles.calendarCanvas}>
      <ResponsiveTimeRange
        data={data}
        from={`${year}-01-01`}
        to={`${year}-12-31`}
        minValue={0}
        colors={CALENDAR_COLORS}
        emptyColor="color-mix(in srgb, var(--color-ink) 12%, var(--color-bg))"
        margin={{ top: 22, right: 24, bottom: 2, left: 24 }}
        align="top"
        monthLegend={(_year, _month, date) => `${date.getMonth() + 1}月`}
        monthLegendOffset={8}
        weekdays={["日", "月", "火", "水", "木", "金", "土"]}
        weekdayTicks={[0, 2, 4, 6]}
        weekdayLegendOffset={20}
        daySpacing={2}
        dayBorderWidth={0}
        dayRadius={3}
        valueFormat={(value) => `${value}回`}
        isInteractive={true}
        theme={nivoTheme}
      />
    </div>
  );
}
