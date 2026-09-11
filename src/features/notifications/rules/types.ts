import type { Cat, NotificationKind } from "@/db/schema";
import type { CleaningTargetWithStatus } from "@/features/cleaning/targetQueries";

export type { NotificationKind };

type BaseCandidate = {
  catId: string;
  referenceId: string | null;
  /** `notifications.dedupe_key`。同じ判定結果からの二重生成を防ぐ */
  dedupeKey: string;
  dueAt: Date;
};

export type BirthdayYearlyCandidate = BaseCandidate & {
  kind: "birthday_yearly";
  years: number;
};
export type BirthdayHalfYearCandidate = BaseCandidate & {
  kind: "birthday_half_year";
  months: number;
};
export type DaysMilestoneCandidate = BaseCandidate & {
  kind: "days_milestone";
  days: number;
};
export type ShampooElapsedCandidate = BaseCandidate & {
  kind: "shampoo_elapsed";
  elapsedMonths: number;
};
export type WeightMeasurementCandidate = BaseCandidate & {
  kind: "weight_measurement";
  elapsedDays: number;
};
export type CleaningDueCandidate = BaseCandidate & {
  kind: "cleaning_due";
  targetId: string;
  targetName: string;
};

export type NotificationCandidate =
  | BirthdayYearlyCandidate
  | BirthdayHalfYearCandidate
  | DaysMilestoneCandidate
  | ShampooElapsedCandidate
  | WeightMeasurementCandidate
  | CleaningDueCandidate;

/** `notification_settings` を既定値とマージ済みの、猫ごとの通知設定 */
export type ResolvedNotificationSettings = {
  birthdayYearly: { isEnabled: boolean };
  birthdayHalfYear: { isEnabled: boolean };
  daysMilestone: { isEnabled: boolean };
  shampooElapsed: { isEnabled: boolean; months: number };
  weightMeasurement: { isEnabled: boolean; days: number };
  /** 掃除対象 id ごとの有効／無効 */
  cleaningDue: Map<string, { isEnabled: boolean }>;
};

export type EvaluateNotificationRulesInput = {
  now: Date;
  timezone: string;
  cat: Cat;
  settings: ResolvedNotificationSettings;
  latestShampooAt: Date | null;
  latestWeightAt: Date | null;
  cleaningTargets: CleaningTargetWithStatus[];
};
