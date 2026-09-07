export function calculateCatWeightKg(
  combinedWeightKg: number,
  humanWeightKg: number,
): number {
  return combinedWeightKg - humanWeightKg;
}
