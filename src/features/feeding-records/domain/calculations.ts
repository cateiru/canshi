import type { FoodAmountUnit } from "@/db/schema/food-amount-units";

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
  /** 商品の量の単位。推定摂取量はこの単位の値 */
  amountUnit: FoodAmountUnit;
  estimatedIntakeG: number | null;
  estimatedKcal: number | null;
};

/**
 * 1回の食事（またはその日の食事）の推定摂取量・カロリーの合計。カロリーは小数第二位で四捨五入する。
 * 推定摂取量は g と ml を足さず、g の商品を「食べた量」（`totalIntakeG`）、ml の商品を「飲んだ量」
 * （`totalIntakeMl`）として単位ごとに足す。その単位の商品がなければ null にする。
 * あいまいモードの記録は推定値を持たない（null）ため、呼び出し側で厳格モードの
 * 記録に限って使うこと
 */
export function sumFeedingTotals(items: FeedingTotalsItem[]): {
  totalIntakeG: number | null;
  totalIntakeMl: number | null;
  totalKcal: number;
} {
  const sumIntake = (unit: FoodAmountUnit) => {
    const unitItems = items.filter((item) => item.amountUnit === unit);
    return unitItems.length > 0
      ? unitItems.reduce(
          (total, item) => total + (item.estimatedIntakeG ?? 0),
          0,
        )
      : null;
  };
  const totalKcal = items.reduce(
    (total, item) => total + (item.estimatedKcal ?? 0),
    0,
  );
  return {
    totalIntakeG: sumIntake("g"),
    totalIntakeMl: sumIntake("ml"),
    totalKcal: roundKcal(totalKcal),
  };
}

/**
 * 単位ごとの推定摂取量（`sumFeedingTotals` の結果）を、表示する順（g・ml）に並べる。
 * その単位の商品がない（null の）ものは含めない
 */
export function listIntakeTotals(totals: {
  totalIntakeG: number | null;
  totalIntakeMl: number | null;
}): { unit: FoodAmountUnit; total: number }[] {
  return (
    [
      { unit: "g", total: totals.totalIntakeG },
      { unit: "ml", total: totals.totalIntakeMl },
    ] as const
  ).flatMap(({ unit, total }) => (total == null ? [] : [{ unit, total }]));
}
