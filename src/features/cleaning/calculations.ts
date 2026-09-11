import type { CleaningTarget } from "@/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CleaningFrequencyUnit = CleaningTarget["frequencyUnit"];

/**
 * 次回の予定日 = 前回の実施日 + 頻度。まだ一度も実施していない対象は
 * 基準となる前回実施日がなく次回予定日を計算できないため null を返す
 * （「未実施」として表示側で扱う）。
 *
 * 頻度の単位が「月」の場合は日数換算（例: 30日固定）ではなく暦月で加算する
 * （前回実施日と同じ日を N ヶ月後にする）。存在しない日（例: 1/31 の1ヶ月後）は
 * `Date` の仕様に従い翌月に繰り越す（1/31 → 3/3 など）。
 */
export function calculateNextDueAt(
  lastPerformedAt: Date | null,
  frequencyValue: number,
  frequencyUnit: CleaningFrequencyUnit,
): Date | null {
  if (lastPerformedAt == null) {
    return null;
  }
  if (frequencyUnit === "months") {
    const nextDueAt = new Date(lastPerformedAt.getTime());
    nextDueAt.setUTCMonth(nextDueAt.getUTCMonth() + frequencyValue);
    return nextDueAt;
  }
  return new Date(lastPerformedAt.getTime() + frequencyValue * MS_PER_DAY);
}

/**
 * 次回予定日を計算できない（＝未実施の）対象は、期限超過として扱わない。
 */
export function isCleaningOverdue(nextDueAt: Date | null, now: Date): boolean {
  if (nextDueAt == null) {
    return false;
  }
  return nextDueAt.getTime() <= now.getTime();
}
