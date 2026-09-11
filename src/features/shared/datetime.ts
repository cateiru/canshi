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

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 記録の発生日時（フォーム入力のローカル時計の数字をそのまま UTC として保存した値）と
 * 比較・計算するための「現在時刻」を、サーバー側で取得する。Cloudflare Workers 上の
 * `new Date()` は実際の UTC を返すため、そのまま比較すると JST の午前0時〜9時
 * （実UTC日付が前日）で経過日数や期限判定が1日ずれる。MVP にはタイムゾーン設定がなく
 * 常に JST 運用のため、実際の UTC 時刻に JST のオフセットを加算し、保存値と同じ
 * 「naive UTC」の見た目に揃える。
 */
export function getNaiveUtcNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + JST_OFFSET_MS);
}
