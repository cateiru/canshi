"use client";

import { ResponsiveLine } from "@nivo/line";
import { useEffect, useState } from "react";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import type { WeightChartPoint } from "./chart";

type WeightChartCanvasProps = {
  points: WeightChartPoint[];
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

/** Y軸の縦線の一番上に単位ラベルを表示するカスタムレイヤー */
function YAxisUnitLabel() {
  return (
    <text
      x={-30}
      y={-16}
      textAnchor="start"
      style={{
        fill: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
        fontSize: 11,
      }}
    >
      (kg)
    </text>
  );
}

const LAYERS = [
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
  YAxisUnitLabel,
] as const;

function formatAxisDateUtc(value: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(value);
}

const Y_DOMAIN_STEP = 0.1;

/**
 * yScale の min/max を 0.1kg 刻みに丸めて算出する。d3 の `nice: true` に
 * 頼ると、期間が狭いときに目盛りが 0.005kg 刻みなど細かくなりラベルが
 * マージンからはみ出すことがあるため自前で丸める。yScale に具体的な数値
 * を渡すとスケールはクランプされず、areaBaselineValue が軸の範囲外
 * （デフォルトの0など）だと塗りつぶしが軸の下限より下まではみ出すため、
 * areaBaselineValue にもこの min を使う。
 */
function computeYDomain(weights: number[]): { min: number; max: number } {
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const min =
    Math.round(Math.floor(rawMin / Y_DOMAIN_STEP) * Y_DOMAIN_STEP * 100) / 100;
  let max =
    Math.round(Math.ceil(rawMax / Y_DOMAIN_STEP) * Y_DOMAIN_STEP * 100) / 100;
  if (max <= min) {
    max = min + Y_DOMAIN_STEP;
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

export default function WeightChartCanvas({ points }: WeightChartCanvasProps) {
  const data = [
    {
      id: "catWeightKg",
      data: points.map((point) => ({
        x: new Date(point.occurredAtIso),
        y: point.catWeightKg,
      })),
    },
  ];

  const weights = points.map((point) => point.catWeightKg);
  const { min: yMin, max: yMax } = computeYDomain(weights);
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
      margin={{ top: 26, right: 10, bottom: 40, left: 34 }}
      xScale={{ type: "time", precision: "day", useUTC: true }}
      xFormat={(value) => splitDateTimeUtc(value as Date).date}
      yScale={{ type: "linear", min: yMin, max: yMax }}
      axisBottom={{
        format: (value) => formatAxisDateUtc(value as Date),
        tickValues: Math.min(points.length, 6),
      }}
      layers={LAYERS}
      colors={["var(--color-accent)"]}
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
      animate={false}
      enableSlices={false}
      theme={nivoTheme}
    />
  );
}
