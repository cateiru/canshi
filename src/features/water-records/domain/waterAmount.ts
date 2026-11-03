/**
 * 飲水量（値オブジェクト）。給水量と残量の組で、推定飲水量はここから求める。
 * 残量が未入力なら推定飲水量は求めない
 */
export type WaterAmount = Readonly<{
  suppliedMl: number;
  remainingMl: number | null;
}>;

/** 飲水量を作る。残量は給水量以下であること（入力の規則は `./schema.ts` で確かめる） */
export function waterAmount(
  suppliedMl: number,
  remainingMl: number | null | undefined,
): WaterAmount {
  return { suppliedMl, remainingMl: remainingMl ?? null };
}

/**
 * 推定飲水量 = 給水量 − 残量。残量が未入力の場合は計算しない。
 * こぼれがあった場合も計算はするが、参考値であることは表示側で併記する
 */
export function estimatedIntakeMl(amount: WaterAmount): number | null {
  if (amount.remainingMl == null) {
    return null;
  }
  return amount.suppliedMl - amount.remainingMl;
}
