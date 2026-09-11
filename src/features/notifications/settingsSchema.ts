import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";

/**
 * `Intl.DateTimeFormat` の `timeZone` に渡せる値かどうかを検証する。UI の Select は
 * 妥当な値しか送らないが、Server Action は Select を経由しない POST でも到達できるため、
 * ここで検証しないと `Invalid/Zone` のような値がそのまま保存されてしまう。保存された値は
 * 通知生成の cron で `Intl.DateTimeFormat` に渡されるため、不正な値は `RangeError` になり
 * 全猫の通知生成を毎回中断させる
 */
function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const notificationPreferencesFormSchema = z.object({
  notifyTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "通知時刻の形式が正しくありません"),
  timezone: z
    .string()
    .trim()
    .min(1, "タイムゾーンを選択してください")
    .refine(isValidTimeZone, "タイムゾーンの形式が正しくありません"),
});

export type NotificationPreferencesFormInput = z.infer<
  typeof notificationPreferencesFormSchema
>;

export type NotificationPreferencesFormFieldErrors = Partial<
  Record<keyof NotificationPreferencesFormInput, string[]>
>;

export const catNotificationSettingsFormSchema = z.object({
  birthdayYearlyEnabled: checkboxBooleanSchema,
  birthdayHalfYearEnabled: checkboxBooleanSchema,
  daysMilestoneEnabled: checkboxBooleanSchema,
  shampooElapsedEnabled: checkboxBooleanSchema,
  shampooElapsedMonths: z.coerce
    .number({ error: "シャンプーの経過月数は数値で入力してください" })
    .int("シャンプーの経過月数は整数で入力してください")
    .positive("シャンプーの経過月数は0より大きい値を入力してください"),
  weightMeasurementEnabled: checkboxBooleanSchema,
  weightMeasurementDays: z.coerce
    .number({ error: "体重測定の日数は数値で入力してください" })
    .int("体重測定の日数は整数で入力してください")
    .positive("体重測定の日数は0より大きい値を入力してください"),
});

export type CatNotificationSettingsFormInput = z.infer<
  typeof catNotificationSettingsFormSchema
>;

export type CatNotificationSettingsFormFieldErrors = Partial<
  Record<keyof CatNotificationSettingsFormInput, string[]>
>;
