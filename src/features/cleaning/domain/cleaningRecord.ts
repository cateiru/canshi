import type { CleaningRecord } from "@/db/schema";
import { NOTIFY_TIMEZONE } from "@/features/notifications/domain/defaults";
import {
  getNaiveLocalDateParts,
  getNaiveLocalNow,
  localDateToUtcMidnight,
} from "@/features/notifications/domain/rules/localDate";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { cleaningFrequencyOf, nextDueAfter } from "./cleaningFrequency";
import type { CleaningTargetSchedule } from "./cleaningTarget";
import type { CleaningRecordFormInput } from "./recordSchema";

/** 掃除の実施記録（エンティティ）。掃除対象（`CleaningTarget`）に属する */
export type { CleaningRecord };

/** 実施記録の中身。ID・猫・掃除対象・作成日時を除いたもの */
export type CleaningRecordContent = Pick<
  CleaningRecord,
  "performedAt" | "memo"
>;

const MS_PER_MINUTE = 60 * 1000;

/** 入力から実施記録の中身を作る */
export function toCleaningRecordContent(
  data: CleaningRecordFormInput,
): CleaningRecordContent {
  return {
    performedAt: combineDateTimeUtc(data.performedDate, data.performedTime),
    memo: data.memo ?? null,
  };
}

/**
 * 掃除を記録したら、その掃除対象の未対応の掃除の通知（`cleaning_due`）はもう対応する必要が
 * ないため完了にする。完了にするのは、返した日時より前の予定日（`due_at`）の通知。
 * 同じ対象に残っている古い予定日の通知もまとめて完了にする。
 *
 * 次のどちらかの記録では完了にせず、null を返す。
 * - 先の日時の記録。まだ掃除していないため（ごはん記録の `completeFeedingNotifications` と同じ）。
 *   実施日時は naive UTC のため、現在時刻もローカル時計の数字の naive UTC にして比べる
 * - 古い日時の記録で、その記録から数えた次回予定日が通知の予定日を過ぎないもの。
 *   さかのぼって記録しただけで、通知の予定日の掃除はまだしていないため。
 *   通知は予定日ごとに 1 件（`dedupe_key`）のため、ここで完了にすると同じ予定日には
 *   もう通知されなくなる
 *
 * 通知の予定日（`due_at`）は予定日を UTC 0 時にしたもの（`localDateToUtcMidnight`）のため、
 * 記録から数えた次回予定日も同じ形にそろえる
 */
export function cleaningNotificationsDueBefore(
  target: CleaningTargetSchedule,
  performedAt: Date,
  now: Date = new Date(),
): Date | null {
  // `getNaiveLocalNow` は分単位で切り捨てるため、記録の日時も分単位にそろえて比べる。
  // 「今すぐ掃除した」の記録（`getNaiveUtcNow`）は秒を持ち、そのまま比べると先の日時になる
  if (
    Math.floor(performedAt.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE >
    getNaiveLocalNow(now, NOTIFY_TIMEZONE).getTime()
  ) {
    return null;
  }
  const nextDueAt = nextDueAfter(
    cleaningFrequencyOf(target),
    performedAt,
    target.notifyTime,
  );
  return localDateToUtcMidnight(getNaiveLocalDateParts(nextDueAt));
}
