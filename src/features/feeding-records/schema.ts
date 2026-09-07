import { z } from "zod";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";

// FormData から渡る未入力値（空文字・null）を z.coerce.number() が 0 として
// 解釈してしまわないよう、事前に undefined へ正規化してから必須チェックさせる
const emptyToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

export const feedingRecordFormSchema = z
  .object({
    foodProductId: z.string().trim().min(1, "商品を選択してください"),
    occurredDate: z.string().date("発生日の形式が正しくありません"),
    occurredTime: z
      .string()
      .regex(TIME_STRING_PATTERN, "発生時刻の形式が正しくありません"),
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

export type FeedingRecordFormInput = z.infer<typeof feedingRecordFormSchema>;

export type FeedingRecordFormFieldErrors = Partial<
  Record<keyof FeedingRecordFormInput, string[]>
>;
