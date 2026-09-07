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
