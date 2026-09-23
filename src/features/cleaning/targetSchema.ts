import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";

/** 通知時刻を指定しない（全体の通知時刻 18:00 で通知する）ことを表すフォームの値 */
export const NOTIFY_TIME_NONE = "none";

/**
 * 通知はスケジュール実行（`wrangler.toml` の `[triggers]`、15分ごと）のタイミングでしか
 * 生成・送信されないため、15分刻みの時刻だけを受け付ける
 */
const QUARTER_HOUR_TIME_PATTERN = /^([01]\d|2[0-3]):(00|15|30|45)$/;

/** 通知時刻の選択肢（00:00〜23:45 の15分刻み） */
export const NOTIFY_TIME_OPTIONS: string[] = Array.from(
  { length: 24 * 4 },
  (_, index) => {
    const hours = String(Math.floor(index / 4)).padStart(2, "0");
    const minutes = String((index % 4) * 15).padStart(2, "0");
    return `${hours}:${minutes}`;
  },
);

export const cleaningTargetFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "名前を入力してください")
    .max(50, "名前は50文字以内で入力してください"),
  frequencyValue: z.coerce
    .number({ error: "頻度は数値で入力してください" })
    .int("頻度は整数で入力してください")
    .positive("頻度は0より大きい値を入力してください"),
  frequencyUnit: z.enum(["days", "months"], {
    error: "頻度の単位を選択してください",
  }),
  isActive: checkboxBooleanSchema,
  notifyTime: z.preprocess(
    (value) =>
      value == null || value === "" || value === NOTIFY_TIME_NONE
        ? null
        : value,
    z
      .string()
      .regex(
        QUARTER_HOUR_TIME_PATTERN,
        "通知時刻は15分刻みの時刻を選択してください",
      )
      .nullable(),
  ),
});

export type CleaningTargetFormInput = z.infer<typeof cleaningTargetFormSchema>;

export type CleaningTargetFormFieldErrors = Partial<
  Record<keyof CleaningTargetFormInput, string[]>
>;
