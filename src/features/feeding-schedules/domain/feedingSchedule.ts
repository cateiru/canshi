import type { FeedingSchedule } from "@/db/schema";
import type { FeedingScheduleNotifyFormInput } from "./schema";

/**
 * ごはんの時間（エンティティ）。家（`householdId`）に属し、同じ家に同じ時刻は 1 つだけ
 * （`feeding_schedules_household_id_time_unique`）。家のメンバーなら誰でも変えられる
 */
export type { FeedingSchedule };

/** ごはんの時間の通知の設定 */
export type FeedingScheduleNotifySettings = Pick<
  FeedingSchedule,
  "notifyAtTime" | "remindIfNotRecorded"
>;

/** ごはんの時間の中身。ID・家・作成日時を除いたもの */
export type FeedingScheduleContent = Pick<FeedingSchedule, "time"> &
  FeedingScheduleNotifySettings;

/** ごはんの時間から作られる通知の種類 */
export type FeedingNotificationKind = "feeding_time" | "feeding_not_recorded";

export const FEEDING_NOTIFICATION_KINDS: FeedingNotificationKind[] = [
  "feeding_time",
  "feeding_not_recorded",
];

/** 通知の設定でオフにした種類。その種類の未対応の通知は、もう出さないため無視にする */
export function disabledFeedingNotificationKinds(
  input: FeedingScheduleNotifyFormInput,
): FeedingNotificationKind[] {
  return [
    ...(input.notifyAtTime ? [] : (["feeding_time"] as const)),
    ...(input.remindIfNotRecorded ? [] : (["feeding_not_recorded"] as const)),
  ];
}
