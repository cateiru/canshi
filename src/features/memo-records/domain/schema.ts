import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { memoLabelNameSchema } from "./labelSchema";

export const MEMO_CONTENT_MAX_LENGTH = 2000;

/** 1 つのメモに付けられるラベルの数 */
export const MEMO_LABELS_MAX = 20;

const LABELS_ERROR = "ラベルの指定が正しくありません";

const LABELS_MAX_ERROR = `ラベルは${MEMO_LABELS_MAX}個まで付けられます`;

const labelIdSchema = z.string().min(1).max(200);

/**
 * 画面のフォームで付けたラベル。`id` は、画面を開いたときに家にあったラベルの ID
 * （新しく入力したラベルなら null）
 */
const selectedLabelSchema = z.object(
  { id: labelIdSchema.nullable(), name: memoLabelNameSchema },
  { error: LABELS_ERROR },
);

/**
 * ラベルは、外部接続の操作では家にあるラベルの ID（`labelIds`）で、画面のフォームでは
 * `labels` で指定する（付け方は `./memoRecord.ts` の `resolveMemoLabels` 参照）。
 *
 * 「日付を残す」を外したときは日付・時刻の欄を送らないため、日付・時刻は
 * 日付を残すときだけ検証する
 */
export const memoRecordFormSchema = z
  .object({
    hasDate: checkboxBooleanSchema,
    recordedDate: z.unknown(),
    recordedTime: z.unknown(),
    content: z
      .string({ error: "メモを入力してください" })
      .trim()
      .min(1, "メモを入力してください")
      .max(
        MEMO_CONTENT_MAX_LENGTH,
        `メモは${MEMO_CONTENT_MAX_LENGTH}文字以内で入力してください`,
      ),
    labelIds: z
      .array(labelIdSchema, { error: LABELS_ERROR })
      .transform((ids) => [...new Set(ids)])
      .refine((ids) => ids.length <= MEMO_LABELS_MAX, LABELS_MAX_ERROR)
      .default([]),
    labels: z
      .array(selectedLabelSchema, { error: LABELS_ERROR })
      .max(MEMO_LABELS_MAX, LABELS_MAX_ERROR)
      .default([]),
  })
  .transform((data, ctx) => {
    const { content, labelIds, labels } = data;
    const common = { content, labelIds, labels };
    if (!data.hasDate) {
      return { ...common, recordedDate: null, recordedTime: null };
    }
    const date = z.string().date().safeParse(data.recordedDate);
    if (!date.success) {
      ctx.addIssue({
        code: "custom",
        message: "日付の形式が正しくありません",
        path: ["recordedDate"],
      });
    }
    const time = z
      .string()
      .regex(TIME_STRING_PATTERN)
      .safeParse(data.recordedTime);
    if (!time.success) {
      ctx.addIssue({
        code: "custom",
        message: "時刻の形式が正しくありません",
        path: ["recordedTime"],
      });
    }
    if (!date.success || !time.success) {
      return z.NEVER;
    }
    return {
      ...common,
      recordedDate: date.data,
      recordedTime: time.data,
    };
  });

export type MemoRecordFormInput = z.infer<typeof memoRecordFormSchema>;

export type MemoRecordFormFieldErrors = Partial<
  Record<
    | "hasDate"
    | "recordedDate"
    | "recordedTime"
    | "content"
    | "labelIds"
    | "labels",
    string[]
  >
>;
