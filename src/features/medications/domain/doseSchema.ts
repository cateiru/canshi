import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

export const medicationDoseFormSchema = z.object({
  occurredDate: z.string().date("投薬日の形式が正しくありません"),
  occurredTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "投薬時刻の形式が正しくありません"),
  wasAdministered: checkboxBooleanSchema,
  memo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "備考は500文字以内で入力してください")
      .optional(),
  ),
});

export type MedicationDoseFormInput = z.infer<typeof medicationDoseFormSchema>;

export type MedicationDoseFormFieldErrors = Partial<
  Record<keyof MedicationDoseFormInput, string[]>
>;
