import { NOTIFY_TIME } from "../defaults";
import { evaluateBirthdayHalfYear } from "./birthdayHalfYear";
import { evaluateBirthdayYearly } from "./birthdayYearly";
import { evaluateCleaningDue } from "./cleaningDue";
import { evaluateDaysMilestone } from "./daysMilestone";
import { getLocalTimeString } from "./localDate";
import { evaluateShampooElapsed } from "./shampooElapsed";
import type {
  EvaluateNotificationRulesInput,
  NotificationCandidate,
} from "./types";
import { evaluateWeightMeasurement } from "./weightMeasurement";

export * from "./types";

/**
 * 1匹の猫について、今日発火すべき通知の候補を判定する純粋関数。DB アクセスは持たない
 * （`src/features/notifications/generate.ts` が DB から入力を集めて呼び出す）。
 *
 * 掃除以外の通知は全体の通知時刻（18:00）を過ぎるまで生成しない。掃除の通知は対象ごとに
 * 通知時刻を指定できるため、時刻の判定は `evaluateCleaningDue` 側で行う
 */
export function evaluateNotificationRules(
  input: EvaluateNotificationRulesInput,
): NotificationCandidate[] {
  const {
    now,
    timezone,
    cat,
    settings,
    latestShampooAt,
    latestWeightAt,
    cleaningTargets,
  } = input;

  const candidates: NotificationCandidate[] = [
    ...evaluateCleaningDue(
      cat.id,
      now,
      timezone,
      cleaningTargets,
      (targetId) => settings.cleaningDue.get(targetId)?.isEnabled ?? true,
    ),
  ];

  if (getLocalTimeString(now, timezone) < NOTIFY_TIME) {
    return candidates;
  }

  const birthdayYearly = evaluateBirthdayYearly(
    cat.id,
    cat.birthDate,
    now,
    timezone,
    settings.birthdayYearly.isEnabled,
  );
  if (birthdayYearly) {
    candidates.push(birthdayYearly);
  }

  const birthdayHalfYear = evaluateBirthdayHalfYear(
    cat.id,
    cat.birthDate,
    now,
    timezone,
    settings.birthdayHalfYear.isEnabled,
  );
  if (birthdayHalfYear) {
    candidates.push(birthdayHalfYear);
  }

  const daysMilestone = evaluateDaysMilestone(
    cat.id,
    cat.birthDate,
    now,
    timezone,
    settings.daysMilestone.isEnabled,
  );
  if (daysMilestone) {
    candidates.push(daysMilestone);
  }

  const shampooElapsed = evaluateShampooElapsed(
    cat.id,
    now,
    timezone,
    settings.shampooElapsed.isEnabled,
    settings.shampooElapsed.months,
    latestShampooAt,
  );
  if (shampooElapsed) {
    candidates.push(shampooElapsed);
  }

  const weightMeasurement = evaluateWeightMeasurement(
    cat.id,
    now,
    timezone,
    settings.weightMeasurement.isEnabled,
    settings.weightMeasurement.days,
    latestWeightAt,
  );
  if (weightMeasurement) {
    candidates.push(weightMeasurement);
  }

  return candidates;
}
