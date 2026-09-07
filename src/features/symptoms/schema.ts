import { z } from "zod";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

export const symptomFormSchema = z.object({
  symptomType: z
    .string()
    .trim()
    .min(1, "症状の種類を入力してください")
    .max(100, "症状の種類は100文字以内で入力してください"),
  onsetDate: z.string().date("発症日の形式が正しくありません"),
  onsetTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "発症時刻の形式が正しくありません"),
  frequencyOrSeverity: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(100, "回数・程度は100文字以内で入力してください")
      .optional(),
  ),
  appetiteNote: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(200, "食欲メモは200文字以内で入力してください")
      .optional(),
  ),
  energyNote: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(200, "元気メモは200文字以内で入力してください")
      .optional(),
  ),
  status: z.enum(["ongoing", "improving", "resolved"], {
    error: "状態を選択してください",
  }),
  memo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "備考は500文字以内で入力してください")
      .optional(),
  ),
});

export type SymptomFormInput = z.infer<typeof symptomFormSchema>;

export type SymptomFormFieldErrors = Partial<
  Record<keyof SymptomFormInput, string[]>
>;
