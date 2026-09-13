"use client";

import { ResponsiveLine } from "@nivo/line";
import { type ComponentProps, useEffect, useState } from "react";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import type { FeedingChartPoint } from "./chart";

export type FeedingChartMetric = "intake" | "kcal";

type FeedingChartCanvasProps = {
  points: FeedingChartPoint[];
  metric: FeedingChartMetric;
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

function unitLabelStyle() {
  return {
    fill: "var(--color-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: 11,
  } as const;
}

/** Y軸の縦線の一番上に単位ラベル (g) を表示するカスタムレイヤー */
function IntakeYAxisUnitLabel() {
  return (
    <text x={-30} y={-16} textAnchor="start" style={unitLabelStyle()}>
      (g)
    </text>
  );
}

/** Y軸の縦線の一番上に単位ラベル (kcal) を表示するカスタムレイヤー */
function KcalYAxisUnitLabel() {
  return (
    <text x={-30} y={-16} textAnchor="start" style={unitLabelStyle()}>
      (kcal)
    </text>
  );
}

const BASE_LAYERS = [
  "grid",
  "markers",
  "axes",
  "areas",
  "crosshair",
  "lines",
  "points",
  "slices",
  "mesh",
  "legends",
] as const;

function formatAxisDateUtc(value: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(value);
}

type MetricConfig = {
  seriesId: string;
  color: string;
  step: number;
  getValue: (point: FeedingChartPoint) => number;
  layers: ComponentProps<typeof ResponsiveLine>["layers"];
};

const METRIC_CONFIG: Record<FeedingChartMetric, MetricConfig> = {
  intake: {
    seriesId: "feedingIntakeG",
    // 体重記録の推移グラフと同じ色にして「量」の指標であることを揃える
    color: "var(--color-accent)",
    step: 5,
    getValue: (point) => point.totalIntakeG,
    layers: [...BASE_LAYERS, IntakeYAxisUnitLabel],
  },
  kcal: {
    seriesId: "feedingKcal",
    // 水色ベースにして「量」グラフと視覚的に区別する
    color: "var(--color-accent-cool)",
    step: 5,
    getValue: (point) => point.totalKcal,
    layers: [...BASE_LAYERS, KcalYAxisUnitLabel],
  },
};

/**
 * 値の範囲を指定ステップ刻みに丸めて yScale の min/max を算出する。
 * WeightChartCanvas と同じ理由（Nivo の nice による二重丸め回避）で
 * ResponsiveLine 側は nice: false にする。
 */
function computeYDomain(
  values: number[],
  step: number,
): { min: number; max: number } {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = Math.floor(rawMin / step) * step;
  let max = Math.ceil(rawMax / step) * step;
  if (max <= min) {
    max = min + step;
  }
  return { min, max };
}

const nivoTheme = {
  text: {
    fill: "var(--color-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: 11,
  },
  axis: {
    domain: {
      line: {
        stroke: "color-mix(in srgb, var(--color-ink) 20%, var(--color-bg))",
      },
    },
    ticks: {
      line: {
        stroke: "color-mix(in srgb, var(--color-ink) 20%, var(--color-bg))",
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
      fontSize: 12,
    },
  },
};

export default function FeedingChartCanvas({
  points,
  metric,
}: FeedingChartCanvasProps) {
  const config = METRIC_CONFIG[metric];

  const data = [
    {
      id: config.seriesId,
      data: points.map((point) => ({
        x: new Date(point.occurredAtIso),
        y: config.getValue(point),
      })),
    },
  ];

  const values = points.map((point) => config.getValue(point));
  const { min: yMin, max: yMax } = computeYDomain(values, config.step);
  const isCompact = useIsCompact();
  const pointSize = isCompact
    ? points.length <= 2
      ? 10
      : 7
    : points.length <= 2
      ? 16
      : 12;

  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 26, right: 10, bottom: 40, left: 38 }}
      xScale={{ type: "time", precision: "day", useUTC: true }}
      xFormat={(value) => splitDateTimeUtc(value as Date).date}
      yScale={{ type: "linear", min: yMin, max: yMax, nice: false }}
      axisBottom={{
        format: (value) => formatAxisDateUtc(value as Date),
        tickValues: Math.min(points.length, 6),
      }}
      layers={config.layers}
      colors={[config.color]}
      lineWidth={4}
      enableArea={true}
      areaBaselineValue={yMin}
      areaOpacity={0.15}
      pointSize={pointSize}
      pointBorderWidth={isCompact ? 2 : 3}
      pointBorderColor={{ from: "seriesColor" }}
      pointColor="var(--color-bg)"
      enableGridX={false}
      useMesh={true}
      animate={true}
      motionConfig="gentle"
      enableSlices={false}
      theme={nivoTheme}
    />
  );
}
