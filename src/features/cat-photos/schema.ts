import { z } from "zod";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

export const catPhotoFormSchema = z.object({
  takenDate: z.string().date("撮影日の形式が正しくありません"),
  takenTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "撮影時刻の形式が正しくありません"),
  memo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "備考は500文字以内で入力してください")
      .optional(),
  ),
});

export type CatPhotoFormInput = z.infer<typeof catPhotoFormSchema>;

export type CatPhotoFormFieldErrors = Partial<
  Record<keyof CatPhotoFormInput, string[]>
>;
