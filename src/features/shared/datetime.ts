/**
 * すべての記録テーブルの発生日時は UTC として保持する（`src/db/README.md` の規約）。
 * MVP にはタイムゾーン設定がないため、フォームで入力された日付・時刻をそのまま UTC として扱う
 * （ブラウザのローカル時刻への変換は行わない）。
 */
export function combineDateTimeUtc(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

export function splitDateTimeUtc(date: Date): { date: string; time: string } {
  const iso = date.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function formatDateTimeUtc(date: Date): string {
  const { date: d, time: t } = splitDateTimeUtc(date);
  return `${d} ${t}`;
}

export const TIME_STRING_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
