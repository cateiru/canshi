/**
 * 推定飲水量 = 給水量 − 残量。残量が未入力の場合は計算しない。
 * こぼれがあった場合も計算はするが、参考値であることは表示側で併記する。
 */
export function calculateEstimatedIntakeMl(
  suppliedAmountMl: number,
  remainingAmountMl: number | undefined,
): number | null {
  if (remainingAmountMl == null) {
    return null;
  }
  return suppliedAmountMl - remainingAmountMl;
}
