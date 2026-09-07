import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const poopRecordFormSchema = z.object({
  occurredDate: z.string().date("発生日の形式が正しくありません"),
  occurredTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "発生時刻の形式が正しくありません"),
  count: z.coerce
    .number({ error: "回数を入力してください" })
    .int("回数は整数で入力してください")
    .min(1, "回数は1以上で入力してください"),
  amount: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50, "量は50文字以内で入力してください").optional(),
  ),
  color: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50, "色は50文字以内で入力してください").optional(),
  ),
  consistency: z.enum(["hard", "normal", "soft", "liquid"], {
    error: "状態を選択してください",
  }),
  hasBlood: checkboxBooleanSchema,
  hasForeignObject: checkboxBooleanSchema,
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
  memo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "備考は500文字以内で入力してください")
      .optional(),
  ),
});

export type PoopRecordFormInput = z.infer<typeof poopRecordFormSchema>;

export type PoopRecordFormFieldErrors = Partial<
  Record<keyof PoopRecordFormInput, string[]>
>;
