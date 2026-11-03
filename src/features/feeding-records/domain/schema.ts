import { z } from "zod";
import { GIVEN_AMOUNT_LEVELS, LEFTOVER_LEVELS } from "@/db/schema";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";

// FormData から渡る未入力値（空文字・null）を z.coerce.number() が 0 として
// 解釈してしまわないよう、事前に undefined へ正規化してから必須チェックさせる
const emptyToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

const foodProductIdSchema = z.string().trim().min(1, "商品を選択してください");

/** 厳格モードの商品ごとの量（グラム単位） */
export const strictFeedingRecordItemFormSchema = z
  .object({
    foodProductId: foodProductIdSchema,
    givenAmountG: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "与えた量を入力してください" })
        .min(0, "与えた量は0以上で入力してください"),
    ),
    leftoverAmountG: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: "残した量を入力してください" })
        .min(0, "残した量は0以上で入力してください"),
    ),
  })
  .refine((data) => data.leftoverAmountG <= data.givenAmountG, {
    message: "残した量は与えた量以下にしてください",
    path: ["leftoverAmountG"],
  });

/** あいまいモードの商品ごとの量（段階） */
export const approximateFeedingRecordItemFormSchema = z.object({
  foodProductId: foodProductIdSchema,
  givenAmountLevel: z.enum(GIVEN_AMOUNT_LEVELS, {
    error: "与えた量を選択してください",
  }),
  leftoverLevel: z.enum(LEFTOVER_LEVELS, {
    error: "残した量を選択してください",
  }),
});

const feedingRecordBaseShape = {
  occurredDate: z.string().date("記録日の形式が正しくありません"),
  occurredTime: z
    .string()
    .regex(TIME_STRING_PATTERN, "記録時刻の形式が正しくありません"),
};

// モードは記録単位で選ぶため、すべての商品が同じモードの入力形式に従う
export const feedingRecordFormSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({
      ...feedingRecordBaseShape,
      mode: z.literal("strict"),
      items: z
        .array(strictFeedingRecordItemFormSchema)
        .min(1, "商品を1つ以上追加してください"),
    }),
    z.object({
      ...feedingRecordBaseShape,
      mode: z.literal("approximate"),
      items: z
        .array(approximateFeedingRecordItemFormSchema)
        .min(1, "商品を1つ以上追加してください"),
    }),
  ],
  { error: "記録方法を選択してください" },
);

export type StrictFeedingRecordItemFormInput = z.infer<
  typeof strictFeedingRecordItemFormSchema
>;

export type ApproximateFeedingRecordItemFormInput = z.infer<
  typeof approximateFeedingRecordItemFormSchema
>;

export type FeedingRecordFormInput = z.infer<typeof feedingRecordFormSchema>;

export type FeedingRecordItemFieldName =
  | keyof StrictFeedingRecordItemFormInput
  | keyof ApproximateFeedingRecordItemFormInput;

export type FeedingRecordItemFieldErrors = Partial<
  Record<FeedingRecordItemFieldName, string[]>
>;

export type FeedingRecordFormFieldErrors = Partial<
  Record<"occurredDate" | "occurredTime" | "mode" | "items", string[]>
> & {
  itemErrors?: FeedingRecordItemFieldErrors[];
};
