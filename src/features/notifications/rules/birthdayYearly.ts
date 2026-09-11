import {
  getLocalDateParts,
  isLeapYear,
  localDateToUtcMidnight,
  parseDateOnly,
} from "./localDate";
import type { BirthdayYearlyCandidate } from "./types";

/**
 * 誕生日（年ごとの節目）。生年月日の月・日が今日のローカル日付と一致した年に発火する。
 * 生まれた日そのもの（0歳）は節目として扱わない。
 * 2/29 生まれは非うるう年に月日が一致しないため、非うるう年は 2/28 を節目の日として扱う
 * （年齢計算ニ関スル法律の考え方に合わせる）
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

  const isBirthdayFeb29 = birth.month === 2 && birth.day === 29;
  const matchesExactDate =
    today.month === birth.month && today.day === birth.day;
  const matchesNonLeapFallback =
    isBirthdayFeb29 &&
    !isLeapYear(today.year) &&
    today.month === 2 &&
    today.day === 28;

  if (!matchesExactDate && !matchesNonLeapFallback) {
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
