import {
  getLocalDateParts,
  localDateToUtcMidnight,
  parseDateOnly,
} from "./localDate";
import type { BirthdayYearlyCandidate } from "./types";

/**
 * 誕生日（年ごとの節目）。生年月日の月・日が今日のローカル日付と一致した年に発火する。
 * 生まれた日そのもの（0歳）は節目として扱わない
 */
export function evaluateBirthdayYearly(
  catId: string,
  birthDate: string | null,
  now: Date,
  timezone: string,
  isEnabled: boolean,
): BirthdayYearlyCandidate | null {
  if (!isEnabled || !birthDate) {
    return null;
  }

  const birth = parseDateOnly(birthDate);
  const today = getLocalDateParts(now, timezone);

  if (today.month !== birth.month || today.day !== birth.day) {
    return null;
  }

  const years = today.year - birth.year;
  if (years < 1) {
    return null;
  }

  return {
    catId,
    kind: "birthday_yearly",
    referenceId: null,
    dedupeKey: `${catId}:birthday_yearly:${years}`,
    dueAt: localDateToUtcMidnight(today),
    years,
  };
}
