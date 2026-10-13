import { z } from "zod";
import { QUARTER_HOUR_TIME_PATTERN } from "@/features/cleaning/targetSchema";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";

/** ごはんの時間の通知の設定（時間になったときの通知・記録がないときのリマインダー） */
export const feedingScheduleNotifyFormSchema = z.object({
  notifyAtTime: checkboxBooleanSchema,
  remindIfNotRecorded: checkboxBooleanSchema,
});

/**
 * ごはんの時間を追加するフォーム。通知はスケジュール実行（15分ごと）のタイミングでしか
 * 生成されないため、掃除の通知時刻と同じく15分刻みの時刻だけを受け付ける
 */
export const feedingScheduleFormSchema = feedingScheduleNotifyFormSchema.extend(
  {
    time: z
      .string({ error: "時刻を選択してください" })
      .regex(
        QUARTER_HOUR_TIME_PATTERN,
        "時刻は15分刻みの時刻を選択してください",
      ),
  },
);

export type FeedingScheduleNotifyFormInput = z.infer<
  typeof feedingScheduleNotifyFormSchema
>;
export type FeedingScheduleFormInput = z.infer<
  typeof feedingScheduleFormSchema
>;
export type FeedingScheduleFormFieldErrors = Partial<
  Record<keyof FeedingScheduleFormInput, string[]>
>;
