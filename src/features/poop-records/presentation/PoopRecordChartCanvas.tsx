"use client";

import {
  ResponsiveScatterPlot,
  type ScatterPlotTooltipProps,
} from "@nivo/scatterplot";
import { useEffect, useState } from "react";
import type { PoopRecord } from "@/db/schema";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { CONSISTENCY_LABEL } from "../domain/labels";
import type { PoopChartPeriod, PoopChartPlacedPoint } from "./chart";

type PoopRecordChartCanvasProps = {
  period: PoopChartPeriod;
  points: PoopChartPlacedPoint[];
  dayStartIsos: string[];
  gridIndexes: number[];
  tickIndexes: number[];
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

// 期間が長いほど 1 日の列が細くなるため、点も小さくする
const NODE_SIZE: Record<PoopChartPeriod, { compact: number; regular: number }> =
  {
    "1w": { compact: 10, regular: 14 },
    "3m": { compact: 6, regular: 9 },
    "6m": { compact: 5, regular: 7 },
  };

// 同じ日の近い時刻の点が重なっても分かるよう、少し透かす
const NODE_COLOR = "color-mix(in srgb, var(--color-accent) 75%, transparent)";

const nivoTheme = {
  text: {
    fill: "var(--color-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-chart)",
  },
  axis: {
    domain: {
      line: {
        stroke: "var(--color-border)",
      },
    },
    ticks: {
      line: {
        stroke: "var(--color-border)",
      },
    },
    legend: {
      text: {
        fill: "var(--color-ink)",
      },
    },
  },
  grid: {
    line: {
      stroke: "color-mix(in srgb, var(--color-ink) 8%, var(--color-bg))",
    },
  },
  tooltip: {
    container: {
      background: "var(--color-bg)",
      color: "var(--color-ink)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
    },
  },
};

type PoopScatterDatum = {
  x: number;
  y: number;
  occurredAtIso: string;
  consistency: PoopRecord["consistency"];
};

function PoopTooltip({ node }: ScatterPlotTooltipProps<PoopScatterDatum>) {
  return (
    <div
      style={{
        padding: "6px 9px",
        borderRadius: 4,
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-xs)",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {formatDateTimeUtc(new Date(node.data.occurredAtIso))}・
      {CONSISTENCY_LABEL[node.data.consistency]}
    </div>
  );
}

export default function PoopRecordChartCanvas({
  period,
  points,
  dayStartIsos,
  gridIndexes,
  tickIndexes,
}: PoopRecordChartCanvasProps) {
  const isCompact = useIsCompact();
  const nodeSize = isCompact
    ? NODE_SIZE[period].compact
    : NODE_SIZE[period].regular;

  // x は「何列目の日か」。点は列の中心（+0.5）に置き、列の境界に縦線を引く
  const data = [
    {
      id: "poop",
      data: points.map(
        (point): PoopScatterDatum => ({
          x: point.dayIndex + 0.5,
          y: point.hourValue,
          occurredAtIso: point.occurredAtIso,
          consistency: point.consistency,
        }),
      ),
    },
  ];

  const formatDayTick = (value: number | string | Date) => {
    const dayStartIso = dayStartIsos[Math.floor(Number(value))];
    if (!dayStartIso) {
      return "";
    }
    const day = new Date(dayStartIso);
    return `${day.getUTCMonth() + 1}/${day.getUTCDate()}`;
  };

  return (
    <ResponsiveScatterPlot<PoopScatterDatum>
      data={data}
      xScale={{ type: "linear", min: 0, max: dayStartIsos.length, nice: false }}
      yScale={{ type: "linear", min: 0, max: 24, reverse: true, nice: false }}
      margin={{ top: 10, right: 16, bottom: 32, left: 48 }}
      nodeSize={nodeSize}
      colors={[NODE_COLOR]}
      enableGridX={true}
      gridXValues={gridIndexes}
      enableGridY={true}
      gridYValues={HOUR_TICKS}
      axisTop={null}
      axisRight={null}
      axisLeft={{
        tickValues: HOUR_TICKS,
        format: (value) => `${pad2(Number(value))}:00`,
      }}
      axisBottom={{
        tickValues: tickIndexes,
        tickSize: period === "1w" ? 0 : 5,
        format: formatDayTick,
      }}
      tooltip={PoopTooltip}
      isInteractive={true}
      useMesh={true}
      animate={true}
      motionConfig="gentle"
      theme={nivoTheme}
    />
  );
}
