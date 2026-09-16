import type { CleaningRecord } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";

export type CleaningRecordCalendarDatum = {
  day: string;
  value: number;
};

// 実施日カレンダーの色の濃淡（実施回数が多いほど濃い）。
// Chart 側の凡例スウォッチと Canvas 側の colors で共有する
export const CALENDAR_COLORS = [
  "color-mix(in srgb, var(--color-accent) 25%, var(--color-bg))",
  "color-mix(in srgb, var(--color-accent) 50%, var(--color-bg))",
  "color-mix(in srgb, var(--color-accent) 75%, var(--color-bg))",
  "var(--color-accent)",
];

/**
 * listCleaningRecords() の結果を、Nivo の Calendar グラフ用に
 * 「日付ごとの実施回数」の形式へ変換する。
 */
export function toCleaningRecordCalendarData(
  records: Pick<CleaningRecord, "performedAt">[],
): CleaningRecordCalendarDatum[] {
  const countByDay = new Map<string, number>();
  for (const record of records) {
    const { date: day } = splitDateTimeUtc(record.performedAt);
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
  }

  return [...countByDay.entries()]
    .map(([day, value]) => ({ day, value }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export type CalendarDateRange = { from: string; to: string };

/** 今日を終端とする直近1年分の日付範囲を返す */
export function getLastYearRange(now: Date): CalendarDateRange {
  const { date: to } = splitDateTimeUtc(now);
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  from.setUTCDate(from.getUTCDate() + 1);
  return { from: splitDateTimeUtc(from).date, to };
}

/**
 * 指定した日付範囲のデータだけに絞り込む。Nivo の Calendar は色の濃淡の基準（最大値）を
 * from/to の範囲ではなく渡した data 全体から計算するため、表示範囲外の件数に
 * 色の濃淡が引っ張られないよう、範囲内のデータだけを渡す
 */
export function filterCalendarDataToRange(
  data: CleaningRecordCalendarDatum[],
  range: CalendarDateRange,
): CleaningRecordCalendarDatum[] {
  return data.filter(
    (datum) => datum.day >= range.from && datum.day <= range.to,
  );
}
