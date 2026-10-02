import { z } from "zod";
import { GIVEN_AMOUNT_LEVELS } from "@/db/schema";

// FormData から渡る未入力値（空文字・null）を z.coerce.number() が 0 として
// 解釈してしまわないよう、事前に undefined へ正規化してから必須チェックさせる
const emptyToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

const foodProductIdSchema = z.string().trim().min(1, "商品を選択してください");

/** 厳格モードのプリセットの商品ごとの与える量（グラム単位） */
export const strictFeedingPresetItemFormSchema = z.object({
  foodProductId: foodProductIdSchema,
  givenAmountG: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "与える量を入力してください" })
      .min(0, "与える量は0以上で入力してください"),
  ),
});

/** あいまいモードのプリセットの商品ごとの与える量（段階） */
export const approximateFeedingPresetItemFormSchema = z.object({
  foodProductId: foodProductIdSchema,
  givenAmountLevel: z.enum(GIVEN_AMOUNT_LEVELS, {
    error: "与える量を選択してください",
  }),
});

const nameSchema = z
  .string()
  .trim()
  .min(1, "プリセット名を入力してください")
  .max(100, "プリセット名は100文字以内で入力してください");

// モードはプリセット単位で選ぶため、すべての商品が同じモードの入力形式に従う
export const feedingPresetFormSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({
      name: nameSchema,
      mode: z.literal("strict"),
      items: z
        .array(strictFeedingPresetItemFormSchema)
        .min(1, "商品を1つ以上追加してください"),
    }),
    z.object({
      name: nameSchema,
      mode: z.literal("approximate"),
      items: z
        .array(approximateFeedingPresetItemFormSchema)
        .min(1, "商品を1つ以上追加してください"),
    }),
  ],
  { error: "記録方法を選択してください" },
);

export type FeedingPresetFormInput = z.infer<typeof feedingPresetFormSchema>;

export type FeedingPresetItemFieldName =
  | keyof z.infer<typeof strictFeedingPresetItemFormSchema>
  | keyof z.infer<typeof approximateFeedingPresetItemFormSchema>;

export type FeedingPresetItemFieldErrors = Partial<
  Record<FeedingPresetItemFieldName, string[]>
>;

export type FeedingPresetFormFieldErrors = Partial<
  Record<"name" | "mode" | "items", string[]>
> & {
  itemErrors?: FeedingPresetItemFieldErrors[];
};
