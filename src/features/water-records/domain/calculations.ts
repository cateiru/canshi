import { estimatedIntakeMl, waterAmount } from "./waterAmount";

/**
 * 推定飲水量 = 給水量 − 残量。残量が未入力の場合は計算しない（`estimatedIntakeMl`）
 */
export function calculateEstimatedIntakeMl(
  suppliedAmountMl: number,
  remainingAmountMl: number | undefined,
): number | null {
  return estimatedIntakeMl(waterAmount(suppliedAmountMl, remainingAmountMl));
}
