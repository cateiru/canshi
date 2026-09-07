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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 新規記録フォームの「現在時刻」初期値用。ブラウザのローカル時刻の見た目の
 * 数字をそのまま返す（UTC への変換はしない）。`splitDateTimeUtc` を
 * `new Date()`（現在の瞬間）に使うと `.toISOString()` で実際に UTC 変換されて
 * しまい、ユーザーの手元の時計と大きくズレた値（JST なら9時間差）が
 * フォームに入ってしまう。このアプリは入力された日付・時刻の数字をそのまま
 * UTC として保存する方針のため、初期値もユーザーの時計の数字をそのまま
 * 使うのが体験として一貫する。
 */
export function getLocalNowParts(date: Date): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

export const TIME_STRING_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
