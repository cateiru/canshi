import {
  addDays,
  compareLocalDate,
  getLocalDateParts,
  getNaiveLocalDateParts,
  localDateKey,
  localDateToUtcMidnight,
} from "./localDate";
import type { WeightMeasurementCandidate } from "./types";

/**
 * 前回の体重記録から設定した日数が経過した節目。一度も記録していない
 * （`latestWeightAt` が null）猫は対象外とする（`evaluateShampooElapsed` と同じ方針）
 */
export function evaluateWeightMeasurement(
  catId: string,
  now: Date,
  timezone: string,
  isEnabled: boolean,
  days: number,
  latestWeightAt: Date | null,
): WeightMeasurementCandidate | null {
  if (!isEnabled || latestWeightAt == null) {
    return null;
  }

  const lastLocal = getNaiveLocalDateParts(latestWeightAt);
  const dueLocal = addDays(lastLocal, days);
  const today = getLocalDateParts(now, timezone);

  if (compareLocalDate(today, dueLocal) < 0) {
    return null;
  }

  return {
    catId,
    kind: "weight_measurement",
    referenceId: null,
    dedupeKey: `${catId}:weight_measurement:${localDateKey(lastLocal)}`,
    dueAt: localDateToUtcMidnight(dueLocal),
    elapsedDays: days,
  };
}
