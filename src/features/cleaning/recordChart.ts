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

/** データに含まれる年の一覧を、新しい年から順に返す */
export function listCalendarYears(
  data: CleaningRecordCalendarDatum[],
): number[] {
  const years = new Set(data.map((datum) => Number(datum.day.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

/**
 * 指定した年のデータだけに絞り込む。Nivo の Calendar は色の濃淡の基準（最大値）を
 * from/to の範囲ではなく渡した data 全体から計算するため、年を切り替えたときに
 * 他の年の件数に色の濃淡が引っ張られないよう、表示年のデータだけを渡す
 */
export function filterCalendarDataByYear(
  data: CleaningRecordCalendarDatum[],
  year: number,
): CleaningRecordCalendarDatum[] {
  const prefix = `${year}-`;
  return data.filter((datum) => datum.day.startsWith(prefix));
}
