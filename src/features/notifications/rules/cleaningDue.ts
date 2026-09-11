import type { CleaningTargetWithStatus } from "@/features/cleaning/targetQueries";
import {
  compareLocalDate,
  getLocalDateParts,
  getNaiveLocalDateParts,
  localDateKey,
  localDateToUtcMidnight,
} from "./localDate";
import type { CleaningDueCandidate } from "./types";

/**
 * 掃除対象の次回予定日を迎えた節目。`nextDueAt` は `cleaning/calculations.ts` の
 * `calculateNextDueAt` によるもので、naive UTC（保存されたローカル時計の数字）のまま
 * 計算されているため、こちらも `Intl` を経由せず UTC フィールドをそのまま読む
 * （`localDate.ts` のコメント参照）。無効化された対象・未実施の対象は生成しない
 */
export function evaluateCleaningDue(
  catId: string,
  now: Date,
  timezone: string,
  targets: CleaningTargetWithStatus[],
  isEnabledFor: (targetId: string) => boolean,
): CleaningDueCandidate[] {
  const today = getLocalDateParts(now, timezone);
  const candidates: CleaningDueCandidate[] = [];

  for (const { target, nextDueAt } of targets) {
    if (!target.isActive || nextDueAt == null || !isEnabledFor(target.id)) {
      continue;
    }

    const dueLocal = getNaiveLocalDateParts(nextDueAt);
    if (compareLocalDate(today, dueLocal) < 0) {
      continue;
    }

    candidates.push({
      catId,
      kind: "cleaning_due",
      referenceId: target.id,
      dedupeKey: `${catId}:cleaning_due:${target.id}:${localDateKey(dueLocal)}`,
      dueAt: localDateToUtcMidnight(dueLocal),
      targetId: target.id,
      targetName: target.name,
    });
  }

  return candidates;
}
