/**
 * 月単位で記録を表示するページ（タイムライン・支出記録）が共通で使う、
 * `ym`（`YYYY-MM`）クエリパラメータの解釈と月送りの計算。
 */

export type YearMonth = {
  year: number;
  month: number; // 1-12
};

const YM_PATTERN = /^(\d{4})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM` の文字列に整形する */
export function formatYm({ year, month }: YearMonth): string {
  return `${year}-${pad2(month)}`;
}

/**
 * 不正な ym（書式違反・範囲外の年月）が Date.UTC に渡って異常な範囲を
 * 走査しないよう、パース失敗時は常に fallback を使う
 */
export function parseYm(
  value: string | undefined,
  fallback: YearMonth,
): YearMonth {
  const match = value == null ? null : YM_PATTERN.exec(value);
  if (!match) {
    return fallback;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (year < 1970 || year > 2999 || month < 1 || month > 12) {
    return fallback;
  }
  return { year, month };
}

/** `delta` か月だけ前後に移動した年月を返す */
export function shiftYm({ year, month }: YearMonth, delta: number): YearMonth {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}
