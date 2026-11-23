"use client";

import { type LineCustomSvgLayer, ResponsiveLine } from "@nivo/line";
import { useEffect, useState } from "react";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import {
  createKeyedLineLayers,
  type KeyedLineDatum,
  type KeyedLineSeries,
} from "@/features/shared/KeyedLineLayers";
import { usePrefersReducedMotion } from "@/features/shared/usePrefersReducedMotion";
import {
  type FeedingChartMetric,
  type FeedingChartPoint,
  feedingChartValue,
} from "./chart";

type FeedingChartCanvasProps = {
  /** 表示する期間に入る日 */
  points: FeedingChartPoint[];
  /** 期間で絞る前の全件。期間を切り替えたとき、同じ日の点を動かすために使う */
  allPoints: FeedingChartPoint[];
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
    fontSize: "var(--text-chart)",
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

/** Y軸の縦線の一番上に単位ラベル (ml) を表示するカスタムレイヤー */
function IntakeMlYAxisUnitLabel() {
  return (
    <text x={-30} y={-16} textAnchor="start" style={unitLabelStyle()}>
      (ml)
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

function formatAxisDateUtc(value: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(value);
}

/**
 * 食べた量・飲んだ量・カロリーは切り替えて 1 つずつ表示するため、どれもテーマカラーで描く
 * （体重記録の推移グラフとも揃える）
 */
const SERIES_COLOR = "var(--color-accent)";

type MetricConfig = {
  seriesId: string;
  step: number;
  unitLabelLayer: LineCustomSvgLayer<KeyedLineSeries>;
};

const METRIC_CONFIG: Record<FeedingChartMetric, MetricConfig> = {
  intake: {
    seriesId: "feedingIntakeG",
    step: 5,
    unitLabelLayer: IntakeYAxisUnitLabel,
  },
  intakeMl: {
    seriesId: "feedingIntakeMl",
    step: 5,
    unitLabelLayer: IntakeMlYAxisUnitLabel,
  },
  kcal: {
    seriesId: "feedingKcal",
    step: 5,
    unitLabelLayer: KcalYAxisUnitLabel,
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

export default function FeedingChartCanvas({
  points,
  allPoints,
  metric,
}: FeedingChartCanvasProps) {
  const config = METRIC_CONFIG[metric];
  // 呼び出し側（FeedingChart）で値のある日の点だけに絞っているため、null は来ない
  const getValue = (point: FeedingChartPoint) =>
    feedingChartValue(point, metric) ?? 0;

  // 点は日ごとの合計なので、日付（occurredAtIso）を key にする
  const toKeyedLineDatum = (point: FeedingChartPoint): KeyedLineDatum => ({
    key: point.occurredAtIso,
    x: new Date(point.occurredAtIso),
    y: getValue(point),
  });
  const data: KeyedLineSeries[] = [
    {
      id: config.seriesId,
      data: points.map(toKeyedLineDatum),
    },
  ];
  // Nivo の lines・points は「何番目の点か」で動かすため、日付で描くレイヤーに置き換える
  const keyedLayers = createKeyedLineLayers(allPoints.map(toKeyedLineDatum));

  const values = points.map(getValue);
  const { min: yMin, max: yMax } = computeYDomain(values, config.step);
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
      margin={{ top: 30, right: 10, bottom: 40, left: 50 }}
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
        config.unitLabelLayer,
      ]}
      colors={[SERIES_COLOR]}
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
      // 行き過ぎて揺れる gentle ではなく、揺れずに止まる default（減衰比がほぼ 1）にする。
      // 動きを減らす設定の端末では動かさない
      animate={!prefersReducedMotion}
      motionConfig="default"
      enableSlices={false}
      theme={nivoTheme}
    />
  );
}
