const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDateOnly(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * 前回のシャンプーからの経過日数を、UTC の日付（時刻を切り捨てたもの）の差分で計算する。
 * このアプリは発生日時を常に naive UTC として扱う（`combineDateTimeUtc` 参照）ため、
 * 時刻をまたぐ差分ではなく暦日の差分を返す。
 */
export function calculateElapsedDays(performedAt: Date, now: Date): number {
  return Math.round(
    (toUtcDateOnly(now) - toUtcDateOnly(performedAt)) / MS_PER_DAY,
  );
}
