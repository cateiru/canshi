import { z } from "zod";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

export const medicationFormSchema = z
  .object({
    symptomId: z.preprocess(emptyToUndefined, z.string().optional()),
    name: z
      .string()
      .trim()
      .min(1, "薬名を入力してください")
      .max(100, "薬名は100文字以内で入力してください"),
    doseAmount: z
      .string()
      .trim()
      .min(1, "1回量を入力してください")
      .max(50, "1回量は50文字以内で入力してください"),
    dosesPerDay: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "1日あたりの回数を入力してください" })
        .int("1日あたりの回数は整数で入力してください")
        .min(1, "1日あたりの回数は1以上で入力してください"),
    ),
    startDate: z.string().date("服用開始日の形式が正しくありません"),
    endDate: z.preprocess(
      emptyToUndefined,
      z.string().date("終了予定日の形式が正しくありません").optional(),
    ),
  })
  .refine((data) => data.endDate == null || data.endDate >= data.startDate, {
    message: "終了予定日は服用開始日以降にしてください",
    path: ["endDate"],
  });

export type MedicationFormInput = z.infer<typeof medicationFormSchema>;

export type MedicationFormFieldErrors = Partial<
  Record<keyof MedicationFormInput, string[]>
>;
