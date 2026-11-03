import {
  addMonths,
  compareLocalDate,
  getLocalDateParts,
  getNaiveLocalDateParts,
  type LocalDate,
  localDateKey,
  localDateToUtcMidnight,
} from "./localDate";
import type { OpenSymptom, SymptomOngoingCandidate } from "./types";

/** 発症日から `today` までに経過した暦月数（`addMonths(onset, n) <= today` を満たす最大の n） */
function elapsedMonthsSince(onset: LocalDate, today: LocalDate): number {
  let months = (today.year - onset.year) * 12 + (today.month - onset.month);
  while (months > 0 && compareLocalDate(addMonths(onset, months), today) > 0) {
    months--;
  }
  return Math.max(months, 0);
}

/**
 * 発症から1ヶ月以上経っても未解消（`ongoing`・`improving`）のままの症状について、
 * 解消したかを確認する通知。
 *
 * 基準日は発症日（`onsetAt`。naive UTC のため `Intl` を経由せず読む）とし、この症状の
 * 通知に一度でも対応（完了・無視）していれば、最後に対応した日（`lastAnsweredAt`。
 * `notifications.updated_at` の実時刻のため通知用タイムゾーンで日付にする）を基準日にする。
 * 基準日から1ヶ月後を迎えたら生成するため、「まだ続いている」と答えると次は1ヶ月後に
 * 再び確認する。dedupe key は基準日ごとに変わるため、同じ確認が二重に生成されることはない。
 *
 * 未対応（`pending`・`snoozed`）の通知が残っている症状は、確認が積み重ならないよう生成しない
 */
export function evaluateSymptomOngoing(
  catId: string,
  now: Date,
  timezone: string,
  isEnabled: boolean,
  openSymptoms: OpenSymptom[],
): SymptomOngoingCandidate[] {
  if (!isEnabled) {
    return [];
  }

  const today = getLocalDateParts(now, timezone);
  const candidates: SymptomOngoingCandidate[] = [];

  for (const symptom of openSymptoms) {
    if (symptom.hasOpenNotification) {
      continue;
    }

    const onsetLocal = getNaiveLocalDateParts(symptom.onsetAt);
    const baseLocal =
      symptom.lastAnsweredAt == null
        ? onsetLocal
        : getLocalDateParts(symptom.lastAnsweredAt, timezone);
    const dueLocal = addMonths(baseLocal, 1);
    if (compareLocalDate(today, dueLocal) < 0) {
      continue;
    }

    candidates.push({
      catId,
      kind: "symptom_ongoing",
      referenceId: symptom.id,
      dedupeKey: `${catId}:symptom_ongoing:${symptom.id}:${localDateKey(baseLocal)}`,
      dueAt: localDateToUtcMidnight(dueLocal),
      symptomId: symptom.id,
      symptomType: symptom.symptomType,
      status: symptom.status,
      elapsedMonths: Math.max(elapsedMonthsSince(onsetLocal, today), 1),
    });
  }

  return candidates;
}
