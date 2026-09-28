type YearMonthDay = {
  year: number;
  month: number;
  day: number;
};

function parseDateOnly(dateString: string): YearMonthDay {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function toUtcYearMonthDay(date: Date): YearMonthDay {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export type Age = {
  years: number;
  months: number;
  days: number;
};

/**
 * 生年月日から満年齢（年・月・日）を計算する。
 * `now` は UTC の暦日として扱う（Cloudflare Workers のサーバー時刻を基準とする）。
 */
export function calculateAge(birthDate: string, now: Date = new Date()): Age {
  const birth = parseDateOnly(birthDate);
  const today = toUtcYearMonthDay(now);

  let years = today.year - birth.year;
  let months = today.month - birth.month;

  if (today.day < birth.day) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  years = Math.max(years, 0);
  months = Math.max(months, 0);

  const totalMonths = years * 12 + months;
  const anchorUtc = Date.UTC(
    birth.year,
    birth.month - 1 + totalMonths,
    birth.day,
  );
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const days = Math.max(
    Math.round((todayUtc - anchorUtc) / (1000 * 60 * 60 * 24)),
    0,
  );

  return { years, months, days };
}

/**
 * 経過した年・月・日を表示用の文字列に変換する。
 * 1年未満の場合は日数まで表示する（例: 「3ヶ月と15日」「15日」）。
 */
function formatElapsed(elapsed: Age, yearUnit: string): string {
  if (elapsed.years === 0) {
    if (elapsed.months === 0) {
      return `${elapsed.days}日`;
    }
    if (elapsed.days === 0) {
      return `${elapsed.months}ヶ月`;
    }
    return `${elapsed.months}ヶ月と${elapsed.days}日`;
  }
  if (elapsed.months === 0) {
    return `${elapsed.years}${yearUnit}`;
  }
  return `${elapsed.years}${yearUnit}${elapsed.months}ヶ月`;
}

/**
 * 満年齢を表示用の文字列に変換する。
 * 1歳未満の場合は日数まで表示する（例: 「3ヶ月と15日」「15日」）。
 */
export function formatAge(age: Age): string {
  return formatElapsed(age, "歳");
}

/**
 * お迎え日から現在までの経過期間（年・月・日）を計算する。
 * 年齢と同じ数え方にするため、満年齢と同じ計算を使う。
 * `now` は UTC の暦日として扱う。
 */
export function calculateTimeSinceAdoption(
  adoptedAt: string,
  now: Date = new Date(),
): Age {
  return calculateAge(adoptedAt, now);
}

/**
 * お迎えからの経過期間を表示用の文字列に変換する。
 * 年齢と同じ形式で、年の単位だけ「年」にする（例: 「1年3ヶ月」「3ヶ月と15日」）。
 */
export function formatTimeSinceAdoption(elapsed: Age): string {
  return formatElapsed(elapsed, "年");
}
