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
 * 満年齢を表示用の文字列に変換する。
 * 1歳未満の場合は日数まで表示する（例: 「3ヶ月と15日」「15日」）。
 */
export function formatAge(age: Age): string {
  if (age.years === 0) {
    if (age.months === 0) {
      return `${age.days}日`;
    }
    if (age.days === 0) {
      return `${age.months}ヶ月`;
    }
    return `${age.months}ヶ月と${age.days}日`;
  }
  if (age.months === 0) {
    return `${age.years}歳`;
  }
  return `${age.years}歳${age.months}ヶ月`;
}

/**
 * お迎え日から現在までの経過日数を計算する。
 * `now` は UTC の暦日として扱う。
 */
export function calculateDaysSinceAdoption(
  adoptedAt: string,
  now: Date = new Date(),
): number {
  const adopted = parseDateOnly(adoptedAt);
  const today = toUtcYearMonthDay(now);

  const adoptedUtc = Date.UTC(adopted.year, adopted.month - 1, adopted.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);

  return Math.round((todayUtc - adoptedUtc) / (1000 * 60 * 60 * 24));
}
