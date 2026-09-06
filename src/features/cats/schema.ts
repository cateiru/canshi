import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const catFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "名前を入力してください")
    .max(50, "名前は50文字以内で入力してください"),
  sex: z.enum(["male", "female", "unknown"], {
    error: "性別を選択してください",
  }),
  birthDate: z.preprocess(
    emptyToUndefined,
    z.string().date("生年月日の形式が正しくありません").optional(),
  ),
  breed: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50, "猫種は50文字以内で入力してください").optional(),
  ),
  adoptedAt: z.preprocess(
    emptyToUndefined,
    z.string().date("お迎え日の形式が正しくありません").optional(),
  ),
});

export type CatFormInput = z.infer<typeof catFormSchema>;

export type CatFormFieldErrors = Partial<Record<keyof CatFormInput, string[]>>;
