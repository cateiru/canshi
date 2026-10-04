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

type FeedingTotalsItem = {
  estimatedIntakeG: number | null;
  estimatedKcal: number | null;
};

/**
 * 1回の食事の推定摂取量・カロリーの合計。あいまいモードの記録は推定値を
 * 持たない（null）ため、呼び出し側で厳格モードの記録に限って使うこと
 */
export function sumFeedingTotals(items: FeedingTotalsItem[]): {
  totalIntakeG: number;
  totalKcal: number;
} {
  return items.reduce(
    (totals, item) => ({
      totalIntakeG: totals.totalIntakeG + (item.estimatedIntakeG ?? 0),
      totalKcal: totals.totalKcal + (item.estimatedKcal ?? 0),
    }),
    { totalIntakeG: 0, totalKcal: 0 },
  );
}
