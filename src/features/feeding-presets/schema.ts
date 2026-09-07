import { z } from "zod";

// FormData から渡る未入力値（空文字・null）を z.coerce.number() が 0 として
// 解釈してしまわないよう、事前に undefined へ正規化してから必須チェックさせる
const emptyToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

export const feedingPresetItemFormSchema = z.object({
  foodProductId: z.string().trim().min(1, "商品を選択してください"),
  givenAmountG: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "与える量を入力してください" })
      .min(0, "与える量は0以上で入力してください"),
  ),
});

export const feedingPresetFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "プリセット名を入力してください")
    .max(100, "プリセット名は100文字以内で入力してください"),
  items: z
    .array(feedingPresetItemFormSchema)
    .min(1, "商品を1つ以上追加してください"),
});

export type FeedingPresetItemFormInput = z.infer<
  typeof feedingPresetItemFormSchema
>;

export type FeedingPresetFormInput = z.infer<typeof feedingPresetFormSchema>;

export type FeedingPresetItemFieldErrors = Partial<
  Record<keyof FeedingPresetItemFormInput, string[]>
>;

export type FeedingPresetFormFieldErrors = Partial<
  Record<"name" | "items", string[]>
> & {
  itemErrors?: FeedingPresetItemFieldErrors[];
};
