import { evaluateBirthdayHalfYear } from "./birthdayHalfYear";
import { evaluateBirthdayYearly } from "./birthdayYearly";
import { evaluateCleaningDue } from "./cleaningDue";
import { evaluateDaysMilestone } from "./daysMilestone";
import { evaluateShampooElapsed } from "./shampooElapsed";
import type {
  EvaluateNotificationRulesInput,
  NotificationCandidate,
} from "./types";
import { evaluateWeightMeasurement } from "./weightMeasurement";

export * from "./types";

/**
 * 1匹の猫について、今日発火すべき通知の候補を判定する純粋関数。DB アクセスは持たない
 * （`src/features/notifications/generate.ts` が DB から入力を集めて呼び出す）
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

  const candidates: NotificationCandidate[] = [];

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

  candidates.push(
    ...evaluateCleaningDue(
      cat.id,
      now,
      timezone,
      cleaningTargets,
      (targetId) => settings.cleaningDue.get(targetId)?.isEnabled ?? true,
    ),
  );

  return candidates;
}
