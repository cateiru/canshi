import type { HospitalVisit } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";

export type HospitalVisitCalendarDatum = {
  day: string;
  value: number;
};

/**
 * listHospitalVisits() の結果を、Nivo の Calendar グラフ用に
 * 「日付ごとの通院回数」の形式へ変換する。
 */
export function toHospitalVisitCalendarData(
  visits: Pick<HospitalVisit, "visitedAt">[],
): HospitalVisitCalendarDatum[] {
  const countByDay = new Map<string, number>();
  for (const visit of visits) {
    const { date: day } = splitDateTimeUtc(visit.visitedAt);
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
  }

  return [...countByDay.entries()]
    .map(([day, value]) => ({ day, value }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** データに含まれる年の一覧を、新しい年から順に返す */
export function listCalendarYears(
  data: HospitalVisitCalendarDatum[],
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
  data: HospitalVisitCalendarDatum[],
  year: number,
): HospitalVisitCalendarDatum[] {
  const prefix = `${year}-`;
  return data.filter((datum) => datum.day.startsWith(prefix));
}
