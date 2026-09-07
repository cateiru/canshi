import { z } from "zod";

// FormData から渡る未入力値（空文字・null）を z.coerce.number() が 0 として
// 解釈してしまわないよう、事前に undefined へ正規化してから必須チェックさせる
const emptyToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

export const foodProductFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "商品名を入力してください")
    .max(100, "商品名は100文字以内で入力してください"),
  kcalPer100g: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "カロリー（kcal/100g）を入力してください" })
      .positive("カロリー（kcal/100g）は0より大きい値を入力してください"),
  ),
  packageAmountG: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "内容量（g）を入力してください" })
      .positive("内容量（g）は0より大きい値を入力してください"),
  ),
  nutritionType: z.enum(["complete", "general"], {
    error: "総合栄養食／一般食の区分を選択してください",
  }),
  textureType: z.enum(["dry", "wet"], {
    error: "ドライ／ウェットの区分を選択してください",
  }),
});

export type FoodProductFormInput = z.infer<typeof foodProductFormSchema>;

export type FoodProductFormFieldErrors = Partial<
  Record<keyof FoodProductFormInput, string[]>
>;
