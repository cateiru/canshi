import type { FeedingMode } from "@/db/schema";
import { sumFeedingTotals } from "./calculations";

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

type FeedingChartRecord = {
  occurredAt: Date;
  mode: FeedingMode;
  items: { estimatedIntakeG: number | null; estimatedKcal: number | null }[];
};

/**
 * listFeedingRecords() の結果を、Nivo の折れ線グラフ用に日付単位で集計する。
 * 同じ日に複数回食事した記録があっても、その日の合計を1点として扱う
 * （一覧の日付区切りと表示単位を揃える）。
 * カロリーは小数第二位で四捨五入する。
 * あいまいモードの記録は摂取量・カロリーを持たないため、グラフには含めない
 */
export function toFeedingChartPoints(
  records: FeedingChartRecord[],
): FeedingChartPoint[] {
  // 記録ごとに丸めてから足すと端数がずれるため、日ごとに商品をまとめて一度だけ合計・丸める
  const itemsByDate = new Map<string, FeedingChartRecord["items"]>();

  for (const record of records) {
    if (record.mode !== "strict") {
      continue;
    }
    const dateKey = record.occurredAt.toISOString().slice(0, 10);
    const items = itemsByDate.get(dateKey) ?? [];
    items.push(...record.items);
    itemsByDate.set(dateKey, items);
  }

  return [...itemsByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dateKey, items]) => ({
      occurredAtIso: `${dateKey}T00:00:00.000Z`,
      ...sumFeedingTotals(items),
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
