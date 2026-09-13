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
 * listFeedingRecords() の結果を、Nivo の折れ線グラフ用に日付単位で集計する。
 * 同じ日に複数回食事した記録があっても、その日の合計を1点として扱う
 * （一覧の日付区切りと表示単位を揃える）。
 */
export function toFeedingChartPoints(
  records: Pick<FeedingRecordWithItems, "occurredAt" | "items">[],
): FeedingChartPoint[] {
  const totalsByDate = new Map<
    string,
    { totalIntakeG: number; totalKcal: number }
  >();

  for (const record of records) {
    const dateKey = record.occurredAt.toISOString().slice(0, 10);
    const totals = totalsByDate.get(dateKey) ?? {
      totalIntakeG: 0,
      totalKcal: 0,
    };
    for (const item of record.items) {
      totals.totalIntakeG += item.estimatedIntakeG;
      totals.totalKcal += item.estimatedKcal;
    }
    totalsByDate.set(dateKey, totals);
  }

  return [...totalsByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dateKey, totals]) => ({
      occurredAtIso: `${dateKey}T00:00:00.000Z`,
      totalIntakeG: totals.totalIntakeG,
      totalKcal: totals.totalKcal,
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
