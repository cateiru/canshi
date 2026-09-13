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

  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 16, right: 24, bottom: 40, left: 48 }}
      xScale={{ type: "time", precision: "day", useUTC: true }}
      xFormat={(value) => splitDateTimeUtc(value as Date).date}
      yScale={{ type: "linear", min: "auto", max: "auto", nice: true }}
      axisBottom={{
        format: (value) => formatAxisDateUtc(value as Date),
        tickValues: Math.min(points.length, 6),
      }}
      axisLeft={{
        format: (value) => `${value}kg`,
      }}
      colors={["var(--color-accent)"]}
      lineWidth={2}
      pointSize={points.length <= 2 ? 8 : 5}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      pointColor="var(--color-ink)"
      enableGridX={false}
      useMesh={true}
      animate={false}
      enableSlices={false}
      theme={nivoTheme}
    />
  );
}
