import { z } from "zod";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

export const shampooRecordFormSchema = z.object({
  performedDate: z.string().date("実施日の形式が正しくありません"),
  performedTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "実施時刻の形式が正しくありません"),
  memo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "備考は500文字以内で入力してください")
      .optional(),
  ),
});

export type ShampooRecordFormInput = z.infer<typeof shampooRecordFormSchema>;

export type ShampooRecordFormFieldErrors = Partial<
  Record<keyof ShampooRecordFormInput, string[]>
>;
