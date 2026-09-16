"use client";

import { ResponsiveCalendar } from "@nivo/calendar";
import { useEffect, useState } from "react";
import type { HospitalVisitCalendarDatum } from "./chart";
import { CALENDAR_COLORS } from "./labels";

type HospitalVisitChartCanvasProps = {
  data: HospitalVisitCalendarDatum[];
  year: number;
};

const COMPACT_BREAKPOINT_PX = 480;

/** SP幅（page.module.css 等と同じ480pxブレークポイント）かどうかを判定する */
function useIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT_PX}px)`);
    setIsCompact(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isCompact;
}

const nivoTheme = {
  text: {
    fill: "var(--color-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: 11,
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

export default function HospitalVisitChartCanvas({
  data,
  year,
}: HospitalVisitChartCanvasProps) {
  const isCompact = useIsCompact();

  return (
    <ResponsiveCalendar
      data={data}
      from={`${year}-01-01`}
      to={`${year}-12-31`}
      minValue={0}
      colors={CALENDAR_COLORS}
      emptyColor="color-mix(in srgb, var(--color-ink) 6%, var(--color-bg))"
      margin={
        isCompact
          ? { top: 10, right: 10, bottom: 10, left: 10 }
          : { top: 20, right: 20, bottom: 20, left: 20 }
      }
      dayBorderWidth={2}
      dayBorderColor="var(--color-bg)"
      monthBorderWidth={1}
      monthBorderColor="color-mix(in srgb, var(--color-ink) 20%, var(--color-bg))"
      monthLegendOffset={isCompact ? 6 : 10}
      valueFormat={(value) => `${value}回`}
      isInteractive={true}
      theme={nivoTheme}
    />
  );
}
