import {
  addMonths,
  compareLocalDate,
  getLocalDateParts,
  getNaiveLocalDateParts,
  localDateKey,
  localDateToUtcMidnight,
} from "./localDate";
import type { ShampooElapsedCandidate } from "./types";

/**
 * 前回のシャンプーから設定した月数が経過した節目。一度も実施していない（`latestShampooAt`
 * が null）猫は基準となる前回実施日がなく判定できないため対象外とする
 * （`src/features/cleaning/calculations.ts` の未実施の扱いと同じ方針）。
 * dedupe key は前回実施日を基準にするため、次にシャンプーするまで同じ通知は再生成されない
 * （再度知らせたい場合は通知センター（`30`）の延期で対応する）
 */
export function evaluateShampooElapsed(
  catId: string,
  now: Date,
  timezone: string,
  isEnabled: boolean,
  months: number,
  latestShampooAt: Date | null,
): ShampooElapsedCandidate | null {
  if (!isEnabled || latestShampooAt == null) {
    return null;
  }

  const lastLocal = getNaiveLocalDateParts(latestShampooAt);
  const dueLocal = addMonths(lastLocal, months);
  const today = getLocalDateParts(now, timezone);

  if (compareLocalDate(today, dueLocal) < 0) {
    return null;
  }

  return {
    catId,
    kind: "shampoo_elapsed",
    referenceId: null,
    dedupeKey: `${catId}:shampoo_elapsed:${localDateKey(lastLocal)}`,
    dueAt: localDateToUtcMidnight(dueLocal),
    elapsedMonths: months,
  };
}
