import {
  addMonths,
  compareLocalDate,
  getLocalDateParts,
  localDateToUtcMidnight,
  parseDateOnly,
} from "./localDate";
import type { BirthdayHalfYearCandidate } from "./types";

/**
 * 生後6か月ごとの節目。12の倍数（1年・2年…）は誕生日と重なるため
 * `evaluateBirthdayYearly` に任せ、ここでは生成しない
 * （`months`（= `halfYears` * 6）が12の倍数になるのは `halfYears` が偶数のときだけなので、
 * 奇数の `halfYears` だけを対象にすれば自然に重複を避けられる）
 */
export function evaluateBirthdayHalfYear(
  catId: string,
  birthDate: string | null,
  now: Date,
  timezone: string,
  isEnabled: boolean,
): BirthdayHalfYearCandidate | null {
  if (!isEnabled || !birthDate) {
    return null;
  }

  const birth = parseDateOnly(birthDate);
  const today = getLocalDateParts(now, timezone);

  for (let halfYears = 1; ; halfYears += 2) {
    const anchor = addMonths(birth, halfYears * 6);
    const comparison = compareLocalDate(anchor, today);
    if (comparison > 0) {
      return null;
    }
    if (comparison === 0) {
      return {
        catId,
        kind: "birthday_half_year",
        referenceId: null,
        dedupeKey: `${catId}:birthday_half_year:${halfYears * 6}`,
        dueAt: localDateToUtcMidnight(today),
        months: halfYears * 6,
      };
    }
  }
}
