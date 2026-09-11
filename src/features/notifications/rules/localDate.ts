/**
 * 通知判定における「ローカル日付」の扱い。
 *
 * タイムゾーン変換（`Intl`）を適用するのは `now`（判定を実行する瞬間）だけでよい。
 * それ以外の入力はすでに「naive ローカル日付」になっている：
 * - `cats.birthDate` は時刻を持たない `YYYY-MM-DD` 文字列
 * - `shampooRecords.performedAt` などの発生日時は、フォームに入力したローカル時計の数字を
 *   そのまま UTC として保存した「naive UTC」（`src/features/shared/datetime.ts` の
 *   `combineDateTimeUtc` を参照）。この値をさらに `Intl` でタイムゾーン変換すると
 *   二重変換になり日付がずれるため、UTC フィールドをそのまま読む
 *
 * こうして得たローカル日付同士を比較することで、`now` を経由した判定と、記録済みの
 * 発生日時を経由した判定が同じ「暦日」の土俵で比較できる。
 */

export type LocalDate = { year: number; month: number; day: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `now`（現在時刻の瞬間）を、指定したタイムゾーンのローカル日付に変換する */
export function getLocalDateParts(now: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** `now`（現在時刻の瞬間）を、指定したタイムゾーンのローカル時刻（HH:MM）に変換する */
export function getLocalTimeString(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/**
 * naive UTC な発生日時（`performedAt` など）を、UTC フィールドをそのまま読んでローカル日付にする。
 * タイムゾーン変換はしない（上記コメント参照）
 */
export function getNaiveLocalDateParts(date: Date): LocalDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** `YYYY-MM-DD` 文字列（`cats.birthDate` など）をローカル日付にする */
export function parseDateOnly(dateString: string): LocalDate {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function localDateKey(date: LocalDate): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  return localDateKey(a) < localDateKey(b)
    ? -1
    : localDateKey(a) > localDateKey(b)
      ? 1
      : 0;
}

/**
 * ローカル日付を、そのまま UTC 0時のタイムスタンプにして DB に保存する（`notifications.due_at`）。
 * 実際にその瞬間を指すわけではなく、他の naive UTC な列と同じ「ローカル時計の数字をそのまま
 * UTC として保持する」規約に沿った、暦日を表すための保存形式
 */
export function localDateToUtcMidnight(date: LocalDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

/** ローカル日付に暦月を加算する。存在しない日は `Date` の仕様に従い翌月に繰り越す */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1 + months, date.day));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** ローカル日付に日数を加算する */
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(
    Date.UTC(date.year, date.month - 1, date.day) + days * MS_PER_DAY,
  );
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** `a - b` を暦日の差分（日数）で返す */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((aUtc - bUtc) / MS_PER_DAY);
}
