import { z } from "zod";

export const MEMO_LABEL_NAME_MAX_LENGTH = 30;

/** ラベルの入力。画面のフォームと外部接続の操作で共通 */
export const memoLabelFormSchema = z.object({
  name: z
    .string({ error: "ラベルの名前を入力してください" })
    .trim()
    .min(1, "ラベルの名前を入力してください")
    .max(
      MEMO_LABEL_NAME_MAX_LENGTH,
      `ラベルの名前は${MEMO_LABEL_NAME_MAX_LENGTH}文字以内で入力してください`,
    ),
});

export type MemoLabelFormInput = z.infer<typeof memoLabelFormSchema>;

export type MemoLabelFormFieldErrors = Partial<
  Record<keyof MemoLabelFormInput, string[]>
>;
