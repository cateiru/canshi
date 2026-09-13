"use client";

import { ResponsiveLine } from "@nivo/line";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import type { WeightChartPoint } from "./chart";

type WeightChartCanvasProps = {
  points: WeightChartPoint[];
};

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
 * 頼ると内部で自動計算された軸の下限と areaBaselineValue が食い違い、
 * 塗りつぶしの底辺が軸の最小目盛りとズレることがあるため、
 * 自前で丸めた値を yScale と areaBaselineValue の双方に使い一致させる。
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

  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 16, right: 24, bottom: 40, left: 60 }}
      xScale={{ type: "time", precision: "day", useUTC: true }}
      xFormat={(value) => splitDateTimeUtc(value as Date).date}
      yScale={{ type: "linear", min: yMin, max: yMax }}
      axisBottom={{
        format: (value) => formatAxisDateUtc(value as Date),
        tickValues: Math.min(points.length, 6),
      }}
      axisLeft={{
        legend: "体重 (kg)",
        legendPosition: "middle",
        legendOffset: -48,
      }}
      colors={["var(--color-accent)"]}
      lineWidth={4}
      enableArea={true}
      areaBaselineValue={yMin}
      areaOpacity={0.15}
      pointSize={points.length <= 2 ? 16 : 12}
      pointBorderWidth={3}
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
