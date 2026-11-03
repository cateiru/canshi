import {
  type CleaningFrequencyUnit,
  cleaningFrequency,
  nextDueAfter,
} from "./cleaningFrequency";

export type { CleaningFrequencyUnit } from "./cleaningFrequency";

/**
 * 次回の予定日 = 前回の実施日 + 頻度（`nextDueAfter`）。まだ一度も実施していない対象は
 * 基準となる前回実施日がなく次回予定日を計算できないため null を返す
 * （「未実施」として表示側で扱う）
 */
export function calculateNextDueAt(
  lastPerformedAt: Date | null,
  frequencyValue: number,
  frequencyUnit: CleaningFrequencyUnit,
  notifyTime: string | null = null,
): Date | null {
  if (lastPerformedAt == null) {
    return null;
  }
  return nextDueAfter(
    cleaningFrequency(frequencyValue, frequencyUnit),
    lastPerformedAt,
    notifyTime,
  );
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
