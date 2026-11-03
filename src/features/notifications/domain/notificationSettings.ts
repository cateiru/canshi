import type { NotificationKind } from "@/db/schema";
import type { CatNotificationSettingsFormInput } from "./settingsSchema";

/** 猫ごとの通知設定のうち、掃除対象ごとではない種類の設定 */
export type CatNotificationKindSetting = {
  kind: Exclude<NotificationKind, "cleaning_due">;
  isEnabled: boolean;
  params: { months?: number; days?: number } | null;
};

/** 掃除対象ごとの通知（`cleaning_due`）の設定 */
export type CleaningTargetSetting = {
  id: string;
  isEnabled: boolean;
};

/** 入力から、掃除対象ごとではない種類の設定を作る（種類は常に 6 件） */
export function toCatNotificationKindSettings(
  data: CatNotificationSettingsFormInput,
): CatNotificationKindSetting[] {
  return [
    {
      kind: "birthday_yearly",
      isEnabled: data.birthdayYearlyEnabled,
      params: null,
    },
    {
      kind: "birthday_half_year",
      isEnabled: data.birthdayHalfYearEnabled,
      params: null,
    },
    {
      kind: "days_milestone",
      isEnabled: data.daysMilestoneEnabled,
      params: null,
    },
    {
      kind: "shampoo_elapsed",
      isEnabled: data.shampooElapsedEnabled,
      params: { months: data.shampooElapsedMonths },
    },
    {
      kind: "weight_measurement",
      isEnabled: data.weightMeasurementEnabled,
      params: { days: data.weightMeasurementDays },
    },
    {
      kind: "symptom_ongoing",
      isEnabled: data.symptomOngoingEnabled,
      params: null,
    },
  ];
}
