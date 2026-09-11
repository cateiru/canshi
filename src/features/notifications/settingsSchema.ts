import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";

export const notificationPreferencesFormSchema = z.object({
  notifyTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "通知時刻の形式が正しくありません"),
  timezone: z.string().trim().min(1, "タイムゾーンを選択してください"),
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
