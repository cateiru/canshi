import { createCleaningTargetRepository } from "@/features/cleaning/infrastructure/cleaningTargetRepository";
import { getNaiveUtcNow } from "@/features/shared/datetime";
import { createSymptomRepository } from "@/features/symptoms/infrastructure/symptomRepository";
import { createNotificationRepository } from "../infrastructure/notificationRepository";

/*
 * 通知センター（`30`）の操作（ユースケース）。ユーザーが参照できる通知（ユーザーの家の猫・
 * ユーザーの家の通知）だけを対象にする。結果をどう伝えるかは呼び出し側（`../presentation/actions.ts`）で決める
 */

/** 通知を完了にする。参照できない・存在しない通知では何もしない */
export async function markNotificationDone(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<void> {
  await createNotificationRepository(d1).setStatusIfAccessible(
    userId,
    id,
    "done",
  );
}

export type MarkCleaningNotificationDoneResult =
  | "done"
  | "not-found"
  | "target-inactive";

/**
 * 掃除の通知（`cleaning_due`）を完了にすると同時に、その掃除対象へ「今すぐ掃除した」
 * 記録を追加する。記録は `src/features/cleaning/application/recordMutations.ts` の
 * `createCleaningRecordNow` と同じく naive UTC の現在時刻で登録する。
 * 完了済みの通知に対しては記録を追加しない（連打などによる二重記録を防ぐ）
 */
export async function markCleaningNotificationDone(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<MarkCleaningNotificationDoneResult> {
  const repository = createNotificationRepository(d1);
  const notification = await repository.findAccessible(userId, id);

  if (
    notification?.kind !== "cleaning_due" ||
    notification.referenceId == null ||
    notification.catId == null
  ) {
    return "not-found";
  }
  if (notification.status === "done") {
    return "done";
  }

  // 無効化済みの掃除対象は編集・記録閲覧のみが仕様のため新規登録は拒否する。
  // 対象の削除時は通知も削除される（`src/features/cleaning/application/targetMutations.ts`）が、
  // 無効化では未対応の通知が残るため、「無視する」で閉じられるよう案内する
  const target = await createCleaningTargetRepository(d1).findScheduleForCat(
    notification.catId,
    notification.referenceId,
    { activeOnly: true },
  );
  if (!target) {
    return "target-inactive";
  }

  await repository.completeWithCleaningRecord(id, getNaiveUtcNow());
  return "done";
}

export type ResolveSymptomNotificationResult =
  | "resolved"
  | "not-found"
  | "symptom-not-found";

/**
 * 症状の確認通知（`symptom_ongoing`）に「解消した」と答えたときに呼ぶ。通知を完了にすると
 * 同時に、対象の症状記録の状態を「解消」に更新する
 */
export async function resolveSymptomNotification(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<ResolveSymptomNotificationResult> {
  const repository = createNotificationRepository(d1);
  const notification = await repository.findAccessible(userId, id);

  if (
    notification?.kind !== "symptom_ongoing" ||
    notification.referenceId == null ||
    notification.catId == null
  ) {
    return "not-found";
  }

  if (
    !(await createSymptomRepository(d1).existsForCat(
      notification.catId,
      notification.referenceId,
    ))
  ) {
    return "symptom-not-found";
  }

  await repository.completeWithSymptomResolved(
    id,
    notification.catId,
    notification.referenceId,
  );
  return "resolved";
}

/** 通知を無視する。参照できない・存在しない通知では何もしない */
export async function dismissNotification(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<void> {
  await createNotificationRepository(d1).setStatusIfAccessible(
    userId,
    id,
    "dismissed",
  );
}

/**
 * 通知を延期する。参照できない・存在しない通知なら false。
 * `snoozedUntil` の到来後は `status` を書き換えなくても未対応として扱われる
 * （`src/features/notifications/domain/status.ts` の `isNotificationPending` 参照）。
 * 延期後の再通知のため `readAt`・`pushedAt` と Push の送信済みの記録もあわせて未対応状態へ戻す
 */
export async function snoozeNotification(
  userId: string,
  id: string,
  snoozedUntil: Date,
  d1?: D1Database,
): Promise<boolean> {
  const repository = createNotificationRepository(d1);
  if (!(await repository.findAccessible(userId, id))) {
    return false;
  }
  await repository.snooze(id, snoozedUntil);
  return true;
}

/** 指定した通知のうち、ユーザーが参照できるものをまとめて既読にする */
export async function markNotificationsRead(
  userId: string,
  ids: string[],
  d1?: D1Database,
): Promise<void> {
  await createNotificationRepository(d1).markReadIfAccessible(
    userId,
    ids,
    new Date(),
  );
}
