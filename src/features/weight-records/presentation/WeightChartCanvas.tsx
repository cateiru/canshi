"use client";

import { ResponsiveLine } from "@nivo/line";
import { useEffect, useState } from "react";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import {
  createKeyedLineLayers,
  type KeyedLineDatum,
  type KeyedLineSeries,
} from "@/features/shared/KeyedLineLayers";
import { usePrefersReducedMotion } from "@/features/shared/usePrefersReducedMotion";
import type { WeightChartPoint } from "./chart";

type WeightChartCanvasProps = {
  /** 表示する期間に入る記録 */
  points: WeightChartPoint[];
  /** 期間で絞る前の全件。期間を切り替えたとき、同じ記録の点を動かすために使う */
  allPoints: WeightChartPoint[];
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
        fontSize: "var(--text-chart)",
      }}
    >
      (kg)
    </text>
  );
}

function formatAxisDateUtc(value: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(value);
}

const Y_DOMAIN_STEP = 0.1;

/**
 * yScale の min/max を 0.1kg 刻みに丸めて算出する。Nivo の linear scale は
 * min/max を数値で明示しても nice がデフォルト true のままで、d3 の
 * `.nice()` がさらに外側の桁（例: 0.2刻み）に丸め直してしまうことがある
 * （期間が狭いと 0.005kg 刻みなど逆に細かくなりラベルがはみ出すことも）。
 * そのため自前で 0.1kg 刻みに丸め、ResponsiveLine 側は `nice: false` で
 * 二重の丸めを止める。areaBaselineValue もこの min と一致させないと、
 * 塗りつぶしが軸の下限より下まではみ出す。
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

function toKeyedLineDatum(point: WeightChartPoint): KeyedLineDatum {
  return {
    key: point.id,
    x: new Date(point.occurredAtIso),
    y: point.catWeightKg,
  };
}

export default function WeightChartCanvas({
  points,
  allPoints,
}: WeightChartCanvasProps) {
  const data: KeyedLineSeries[] = [
    {
      id: "catWeightKg",
      data: points.map(toKeyedLineDatum),
    },
  ];
  // Nivo の lines・points は「何番目の点か」で動かすため、記録の ID で描くレイヤーに置き換える
  const keyedLayers = createKeyedLineLayers(allPoints.map(toKeyedLineDatum));

  const weights = points.map((point) => point.catWeightKg);
  const { min: yMin, max: yMax } = computeYDomain(weights);
  const isCompact = useIsCompact();
  const prefersReducedMotion = usePrefersReducedMotion();
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
      margin={{ top: 30, right: 10, bottom: 40, left: 46 }}
      xScale={{ type: "time", precision: "day", useUTC: true }}
      xFormat={(value) => splitDateTimeUtc(value as Date).date}
      yScale={{ type: "linear", min: yMin, max: yMax, nice: false }}
      axisBottom={{
        format: (value) => formatAxisDateUtc(value as Date),
        tickValues: Math.min(points.length, 6),
      }}
      layers={[
        "grid",
        "markers",
        "axes",
        keyedLayers.areas,
        "crosshair",
        keyedLayers.linesAndPoints,
        "slices",
        "mesh",
        "legends",
        YAxisUnitLabel,
      ]}
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
      // 期間を切り替えたとき点と線が長く動くため、行き過ぎて揺れる gentle ではなく、
      // 揺れずに止まる default（減衰比がほぼ 1）にする。動きを減らす設定の端末では動かさない
      animate={!prefersReducedMotion}
      motionConfig="default"
      enableSlices={false}
      theme={nivoTheme}
    />
  );
}
