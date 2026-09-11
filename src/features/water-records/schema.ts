import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

const optionalNonNegativeNumber = (label: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label}は数値で入力してください` })
      .min(0, `${label}は0以上の値を入力してください`)
      .optional(),
  );

export const waterRecordFormSchema = z
  .object({
    occurredDate: z.string().date("発生日の形式が正しくありません"),
    occurredTime: z
      .string()
      .regex(TIME_STRING_PATTERN, "発生時刻の形式が正しくありません"),
    measurementMethod: z.enum(["measuring_cup", "scale", "visual"], {
      error: "測定方法を選択してください",
    }),
    suppliedAmountMl: z.coerce
      .number({ error: "給水量は数値で入力してください" })
      .positive("給水量は0より大きい値を入力してください"),
    remainingAmountMl: optionalNonNegativeNumber("残量"),
    hasSpill: checkboxBooleanSchema,
    wasWaterChanged: checkboxBooleanSchema,
    subjectiveAmount: z.preprocess(
      emptyToUndefined,
      z
        .enum(["more", "usual", "less"], {
          error: "主観評価の選択が正しくありません",
        })
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
  })
  .refine(
    (data) =>
      data.remainingAmountMl == null ||
      data.remainingAmountMl <= data.suppliedAmountMl,
    {
      message: "残量は給水量以下の値を入力してください",
      path: ["remainingAmountMl"],
    },
  );

export type WaterRecordFormInput = z.infer<typeof waterRecordFormSchema>;

export type WaterRecordFormFieldErrors = Partial<
  Record<keyof WaterRecordFormInput, string[]>
>;
