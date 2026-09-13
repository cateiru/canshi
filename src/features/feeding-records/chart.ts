import type { FeedingRecordWithItems } from "./queries";

export type FeedingChartPoint = {
  occurredAtIso: string;
  totalIntakeG: number;
  totalKcal: number;
};

export type FeedingChartPeriod = "1m" | "3m" | "all";

export const FEEDING_CHART_PERIOD_LABEL: Record<FeedingChartPeriod, string> = {
  "1m": "直近1ヶ月",
  "3m": "直近3ヶ月",
  all: "全期間",
};

const PERIOD_DAYS: Record<Exclude<FeedingChartPeriod, "all">, number> = {
  "1m": 30,
  "3m": 90,
};

/**
 * listFeedingRecords()（occurredAt 降順）の結果を、Nivo の折れ線グラフ用に
 * 昇順・シリアライズ可能な形式へ変換する。1記録（複数商品の合計）を1点とする。
 */
export function toFeedingChartPoints(
  records: Pick<FeedingRecordWithItems, "occurredAt" | "items">[],
): FeedingChartPoint[] {
  return [...records]
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((record) => ({
      occurredAtIso: record.occurredAt.toISOString(),
      totalIntakeG: record.items.reduce(
        (sum, item) => sum + item.estimatedIntakeG,
        0,
      ),
      totalKcal: record.items.reduce(
        (sum, item) => sum + item.estimatedKcal,
        0,
      ),
    }));
}

export function filterByPeriod(
  points: FeedingChartPoint[],
  period: FeedingChartPeriod,
  now: Date,
): FeedingChartPoint[] {
  if (period === "all") {
    return points;
  }

  const thresholdMs = now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return points.filter(
    (point) => new Date(point.occurredAtIso).getTime() >= thresholdMs,
  );
}
