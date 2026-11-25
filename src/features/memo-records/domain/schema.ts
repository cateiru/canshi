import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";

export const MEMO_CONTENT_MAX_LENGTH = 2000;

/** 1 つのメモに付けられるラベルの数 */
export const MEMO_LABELS_MAX = 20;

/**
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
      .array(z.string().min(1).max(200), {
        error: "ラベルの指定が正しくありません",
      })
      .transform((ids) => [...new Set(ids)])
      .refine(
        (ids) => ids.length <= MEMO_LABELS_MAX,
        `ラベルは${MEMO_LABELS_MAX}個まで付けられます`,
      )
      .default([]),
  })
  .transform((data, ctx) => {
    const { content, labelIds } = data;
    if (!data.hasDate) {
      return { content, labelIds, recordedDate: null, recordedTime: null };
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
      content,
      labelIds,
      recordedDate: date.data,
      recordedTime: time.data,
    };
  });

export type MemoRecordFormInput = z.infer<typeof memoRecordFormSchema>;

export type MemoRecordFormFieldErrors = Partial<
  Record<
    "hasDate" | "recordedDate" | "recordedTime" | "content" | "labelIds",
    string[]
  >
>;
