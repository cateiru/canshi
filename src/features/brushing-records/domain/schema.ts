import { z } from "zod";
import { BRUSHING_SHED_AMOUNTS } from "@/db/schema/brushing-records";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

/** ブラッシングにかけた時間（分）の上限 */
export const BRUSHING_DURATION_MAX_MINUTES = 600;

export const brushingRecordFormSchema = z.object({
  performedDate: z.string().date("実施日の形式が正しくありません"),
  performedTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "実施時刻の形式が正しくありません"),
  durationMinutes: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "時間は数値で入力してください" })
      .int("時間は整数（分）で入力してください")
      .min(1, "時間は1分以上で入力してください")
      .max(
        BRUSHING_DURATION_MAX_MINUTES,
        `時間は${BRUSHING_DURATION_MAX_MINUTES}分以内で入力してください`,
      )
      .optional(),
  ),
  shedAmount: z.preprocess(
    emptyToUndefined,
    z
      .enum(BRUSHING_SHED_AMOUNTS, {
        error: "抜け毛の量の選択が正しくありません",
      })
      .optional(),
  ),
  hasMats: checkboxBooleanSchema,
  hasSkinIssue: checkboxBooleanSchema,
  memo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "備考は500文字以内で入力してください")
      .optional(),
  ),
});

export type BrushingRecordFormInput = z.infer<typeof brushingRecordFormSchema>;

export type BrushingRecordFormFieldErrors = Partial<
  Record<keyof BrushingRecordFormInput, string[]>
>;
