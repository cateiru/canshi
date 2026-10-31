export function calculateEstimatedIntakeG(
  givenAmountG: number,
  leftoverAmountG: number,
): number {
  return givenAmountG - leftoverAmountG;
}

export function calculateEstimatedKcal(
  estimatedIntakeG: number,
  kcalPer100g: number,
): number {
  return (estimatedIntakeG * kcalPer100g) / 100;
}

/**
 * カロリーを小数第二位で四捨五入して小数第一位までにする。
 * `toFixed(1)` は 2.55 が "2.5" になるなど二進数の誤差で切り捨てられることがあり、
 * 足し合わせた値にも誤差が乗るため、10 倍した値を有効数字 12 桁に整えてから丸める
 */
export function roundKcal(value: number): number {
  return Math.round(Number((value * 10).toPrecision(12))) / 10;
}

type FeedingTotalsItem = {
  estimatedIntakeG: number | null;
  estimatedKcal: number | null;
};

/**
 * 1回の食事の推定摂取量・カロリーの合計。カロリーは小数第二位で四捨五入する。
 * あいまいモードの記録は推定値を持たない（null）ため、呼び出し側で厳格モードの
 * 記録に限って使うこと
 */
export function sumFeedingTotals(items: FeedingTotalsItem[]): {
  totalIntakeG: number;
  totalKcal: number;
} {
  const totals = items.reduce(
    (totals, item) => ({
      totalIntakeG: totals.totalIntakeG + (item.estimatedIntakeG ?? 0),
      totalKcal: totals.totalKcal + (item.estimatedKcal ?? 0),
    }),
    { totalIntakeG: 0, totalKcal: 0 },
  );
  return { ...totals, totalKcal: roundKcal(totals.totalKcal) };
}
