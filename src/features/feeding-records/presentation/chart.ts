import type { FeedingMode, FoodAmountUnit } from "@/db/schema";
import { sumFeedingTotals } from "../domain/calculations";
import { FEEDING_INTAKE_LABEL } from "../domain/labels";

export type FeedingChartPoint = {
  occurredAtIso: string;
  /** g の商品の推定摂取量（食べた量）の合計。その日に g の商品がなければ null */
  totalIntakeG: number | null;
  /** ml の商品の推定摂取量（飲んだ量）の合計。その日に ml の商品がなければ null */
  totalIntakeMl: number | null;
  totalKcal: number;
};

export type FeedingChartPeriod = "1m" | "3m" | "all";

/**
 * グラフに表示する値（食べた量・飲んだ量・カロリー）。1 つずつ切り替えて表示する。
 * 飲んだ量は ml の商品（スープ・ミルクなど）の量で、g の食べた量とは足さない
 */
export type FeedingChartMetric = "intake" | "intakeMl" | "kcal";

export const FEEDING_CHART_METRIC_LABEL: Record<FeedingChartMetric, string> = {
  intake: FEEDING_INTAKE_LABEL.g,
  intakeMl: FEEDING_INTAKE_LABEL.ml,
  kcal: "カロリー",
};

const FEEDING_CHART_METRIC_ORDER: FeedingChartMetric[] = [
  "intake",
  "intakeMl",
  "kcal",
];

/** 点の値。食べた量・飲んだ量は、その日にその単位の商品がなければ null */
export function feedingChartValue(
  point: FeedingChartPoint,
  metric: FeedingChartMetric,
): number | null {
  switch (metric) {
    case "intake":
      return point.totalIntakeG;
    case "intakeMl":
      return point.totalIntakeMl;
    case "kcal":
      return point.totalKcal;
  }
}

/**
 * 切り替えて表示できる値。食べた量・飲んだ量は、どれかの日にその単位の商品があるときだけ選べる
 * （ml の商品を記録していなければ、今までどおり食べた量とカロリーだけを出す）
 */
export function availableFeedingChartMetrics(
  points: FeedingChartPoint[],
): FeedingChartMetric[] {
  return FEEDING_CHART_METRIC_ORDER.filter(
    (metric) =>
      metric === "kcal" ||
      points.some((point) => feedingChartValue(point, metric) != null),
  );
}

/** 値のある日の点だけにする（食べた量・飲んだ量は、その単位の商品を記録した日だけを描く） */
export function filterByMetric(
  points: FeedingChartPoint[],
  metric: FeedingChartMetric,
): FeedingChartPoint[] {
  return points.filter((point) => feedingChartValue(point, metric) != null);
}

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
  items: {
    amountUnit: FoodAmountUnit;
    estimatedIntakeG: number | null;
    estimatedKcal: number | null;
  }[];
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
