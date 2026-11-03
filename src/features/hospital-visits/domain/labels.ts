import type { HospitalVisit } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";

export function hospitalVisitOptionLabel(hospitalVisit: HospitalVisit): string {
  const { date } = splitDateTimeUtc(hospitalVisit.visitedAt);
  return `${date} ${hospitalVisit.reason}`;
}

// 通院日カレンダーの色の濃淡（通院回数が多いほど濃い）。
// Chart 側の凡例スウォッチと Canvas 側の colors で共有する
export const CALENDAR_COLORS = [
  "color-mix(in srgb, var(--color-accent) 25%, var(--color-bg))",
  "color-mix(in srgb, var(--color-accent) 50%, var(--color-bg))",
  "color-mix(in srgb, var(--color-accent) 75%, var(--color-bg))",
  "var(--color-accent)",
];
