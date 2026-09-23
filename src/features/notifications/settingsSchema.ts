import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";

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
