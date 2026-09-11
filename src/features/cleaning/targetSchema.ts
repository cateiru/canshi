import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";

export const cleaningTargetFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "名前を入力してください")
    .max(50, "名前は50文字以内で入力してください"),
  frequencyDays: z.coerce
    .number({ error: "頻度は数値で入力してください" })
    .int("頻度は整数で入力してください")
    .positive("頻度は0より大きい値を入力してください"),
  isActive: checkboxBooleanSchema,
});

export type CleaningTargetFormInput = z.infer<typeof cleaningTargetFormSchema>;

export type CleaningTargetFormFieldErrors = Partial<
  Record<keyof CleaningTargetFormInput, string[]>
>;
