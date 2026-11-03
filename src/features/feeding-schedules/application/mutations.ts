import { disabledFeedingNotificationKinds } from "../domain/feedingSchedule";
import type {
  FeedingScheduleFormInput,
  FeedingScheduleNotifyFormInput,
} from "../domain/schema";
import { createFeedingScheduleRepository } from "../infrastructure/feedingScheduleRepository";

/*
 * ごはんの時間の保存（ユースケース）。家のメンバーなら誰でも変えられる。
 * メンバーであることはリポジトリの文の中で確かめる
 */

export type FeedingScheduleMutationResult =
  | { ok: true }
  | { ok: false; error: string };

const NOT_MEMBER_ERROR = "この家のメンバーではないため変更できませんでした";

/**
 * 家にごはんの時間を追加する。家のメンバーなら誰でも追加できる。同じ家に同じ時刻は
 * 1 つだけ（`feeding_schedules_household_id_time_unique`）
 */
export async function createFeedingSchedule(
  householdId: string,
  userId: string,
  input: FeedingScheduleFormInput,
  d1?: D1Database,
): Promise<FeedingScheduleMutationResult> {
  const repository = createFeedingScheduleRepository(d1);
  if (await repository.existsAtTime(householdId, input.time)) {
    return { ok: false, error: `${input.time}はすでに追加されています` };
  }

  const created = await repository.addForMember(householdId, userId, {
    time: input.time,
    notifyAtTime: input.notifyAtTime,
    remindIfNotRecorded: input.remindIfNotRecorded,
  });
  if (!created) {
    return { ok: false, error: `${input.time}を追加できませんでした` };
  }
  return { ok: true };
}

/**
 * ごはんの時間の通知の設定を変える。家のメンバーなら誰でも変えられる。
 * オフにした種類の未対応の通知は、同じ batch で無視にする
 */
export async function updateFeedingScheduleNotify(
  householdId: string,
  userId: string,
  scheduleId: string,
  input: FeedingScheduleNotifyFormInput,
  d1?: D1Database,
): Promise<FeedingScheduleMutationResult> {
  const updated = await createFeedingScheduleRepository(
    d1,
  ).updateNotifyForMember(
    householdId,
    userId,
    scheduleId,
    {
      notifyAtTime: input.notifyAtTime,
      remindIfNotRecorded: input.remindIfNotRecorded,
    },
    disabledFeedingNotificationKinds(input),
  );
  if (!updated) {
    return { ok: false, error: NOT_MEMBER_ERROR };
  }
  return { ok: true };
}

/**
 * ごはんの時間を削除する。家のメンバーなら誰でも削除できる。
 * すでに生成した、この時間の未対応の通知は同じ batch で無視にする。
 * 対応済みの通知は履歴として残す（`notifications.reference_id` には外部キーがない）
 */
export async function deleteFeedingSchedule(
  householdId: string,
  userId: string,
  scheduleId: string,
  d1?: D1Database,
): Promise<FeedingScheduleMutationResult> {
  const deleted = await createFeedingScheduleRepository(d1).removeForMember(
    householdId,
    userId,
    scheduleId,
  );
  if (!deleted) {
    return { ok: false, error: NOT_MEMBER_ERROR };
  }
  return { ok: true };
}
