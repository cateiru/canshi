import {
  diffDays,
  getLocalDateParts,
  localDateToUtcMidnight,
  parseDateOnly,
} from "./localDate";
import type { DaysMilestoneCandidate } from "./types";

/** 生後100日ごとの節目 */
export function evaluateDaysMilestone(
  catId: string,
  birthDate: string | null,
  now: Date,
  timezone: string,
  isEnabled: boolean,
): DaysMilestoneCandidate | null {
  if (!isEnabled || !birthDate) {
    return null;
  }

  const birth = parseDateOnly(birthDate);
  const today = getLocalDateParts(now, timezone);
  const days = diffDays(today, birth);

  if (days <= 0 || days % 100 !== 0) {
    return null;
  }

  return {
    catId,
    kind: "days_milestone",
    referenceId: null,
    dedupeKey: `${catId}:days_milestone:${days}`,
    dueAt: localDateToUtcMidnight(today),
    days,
  };
}
