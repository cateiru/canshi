import type { PoopRecord } from "@/db/schema";

export type PoopChartPoint = {
  id: string;
  occurredAtIso: string;
  consistency: PoopRecord["consistency"];
  hourValue: number;
};

export type PoopChartPeriod = "1m" | "3m" | "all";

export const POOP_CHART_PERIOD_LABEL: Record<PoopChartPeriod, string> = {
  "1m": "直近1ヶ月",
  "3m": "直近3ヶ月",
  all: "全期間",
};

const PERIOD_DAYS: Record<Exclude<PoopChartPeriod, "all">, number> = {
  "1m": 30,
  "3m": 90,
};

/**
 * listPoopRecords()（occurredAt 降順）の結果を、Nivo の SwarmPlot 用に
 * 「0時からの経過時間（0〜24の小数）」を取り出した形式へ変換する。
 * occurredAt は datetime.ts の方針どおりユーザー入力の時計の数字をそのまま
 * UTC として保存した値なので、getUTCHours/getUTCMinutes でそのまま
 * 「入力された時刻」を取り出せる。
 */
export function toPoopChartPoints(
  records: Pick<PoopRecord, "id" | "occurredAt" | "consistency">[],
): PoopChartPoint[] {
  return [...records]
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((record) => ({
      id: record.id,
      occurredAtIso: record.occurredAt.toISOString(),
      consistency: record.consistency,
      hourValue:
        record.occurredAt.getUTCHours() +
        record.occurredAt.getUTCMinutes() / 60,
    }));
}

export function filterByPeriod(
  points: PoopChartPoint[],
  period: PoopChartPeriod,
  now: Date,
): PoopChartPoint[] {
  if (period === "all") {
    return points;
  }

  const thresholdMs = now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return points.filter(
    (point) => new Date(point.occurredAtIso).getTime() >= thresholdMs,
  );
}
