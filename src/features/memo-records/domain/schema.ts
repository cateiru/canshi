import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { memoLabelNameSchema } from "./labelSchema";

export const MEMO_CONTENT_MAX_LENGTH = 2000;

/** 1 つのメモに付けられるラベルの数 */
export const MEMO_LABELS_MAX = 20;

/** ラベルの ID・名前の並び。重複を除き、付けられる数までに限る */
function labelListSchema(item: z.ZodType<string>) {
  return z
    .array(item, { error: "ラベルの指定が正しくありません" })
    .transform((values) => [...new Set(values)])
    .refine(
      (values) => values.length <= MEMO_LABELS_MAX,
      `ラベルは${MEMO_LABELS_MAX}個まで付けられます`,
    )
    .default([]);
}

/**
 * ラベルは ID（`labelIds`、外部接続の操作）か名前（`labelNames`、画面のフォーム）で指定する。
 * 名前で指定したラベルがまだなければ、メモの保存と同時に作る。
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
    labelIds: labelListSchema(z.string().min(1).max(200)),
    labelNames: labelListSchema(memoLabelNameSchema),
  })
  .transform((data, ctx) => {
    const { content, labelIds, labelNames } = data;
    const common = { content, labelIds, labelNames };
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
    | "labelNames",
    string[]
  >
>;
