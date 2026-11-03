import type { WeightRecord } from "@/db/schema";

export type WeightChartPoint = {
  occurredAtIso: string;
  catWeightKg: number;
};

export type WeightChartPeriod = "1m" | "3m" | "all";

export const WEIGHT_CHART_PERIOD_LABEL: Record<WeightChartPeriod, string> = {
  "1m": "直近1ヶ月",
  "3m": "直近3ヶ月",
  all: "全期間",
};

const PERIOD_DAYS: Record<Exclude<WeightChartPeriod, "all">, number> = {
  "1m": 30,
  "3m": 90,
};

/**
 * listWeightRecords()（occurredAt 降順）の結果を、Nivo の折れ線グラフ用に
 * 昇順・シリアライズ可能な形式へ変換する。
 */
export function toWeightChartPoints(
  records: Pick<WeightRecord, "occurredAt" | "catWeightKg">[],
): WeightChartPoint[] {
  return [...records]
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((record) => ({
      occurredAtIso: record.occurredAt.toISOString(),
      catWeightKg: record.catWeightKg,
    }));
}

export function filterByPeriod(
  points: WeightChartPoint[],
  period: WeightChartPeriod,
  now: Date,
): WeightChartPoint[] {
  if (period === "all") {
    return points;
  }

  const thresholdMs = now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return points.filter(
    (point) => new Date(point.occurredAtIso).getTime() >= thresholdMs,
  );
}
