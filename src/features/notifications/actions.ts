"use server";

import { requireUser } from "@/features/auth/session";
import {
  dismissNotification,
  markCleaningNotificationDone,
  markNotificationDone,
  markNotificationsRead,
  resolveSymptomNotification,
  snoozeNotification,
} from "./mutations";

export type NotificationActionResult = { error?: string };

/** 通知センター（`30`）から呼ばれる想定の Server Action。結果は戻り値で返す */
export async function markNotificationDoneAction(
  id: string,
): Promise<NotificationActionResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    await markNotificationDone(user.id, id);
    return {};
  } catch (error) {
    console.error("通知の完了処理に失敗しました", error);
    return { error: "通知の完了処理に失敗しました" };
  }
}

/**
 * 掃除の通知（`cleaning_due`）を完了にすると同時に、その掃除対象へ「今すぐ掃除した」
 * 記録を追加する（`markCleaningNotificationDone`）
 */
export async function markCleaningNotificationDoneAction(
  id: string,
): Promise<NotificationActionResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    switch (await markCleaningNotificationDone(user.id, id)) {
      case "done":
        return {};
      case "not-found":
        return { error: "通知が見つかりませんでした" };
      case "target-inactive":
        return {
          error:
            "掃除対象が無効になっているため記録できません。「無視する」で通知を閉じてください",
        };
    }
  } catch (error) {
    console.error("掃除記録の追加と通知の完了処理に失敗しました", error);
    return { error: "掃除記録の追加と通知の完了処理に失敗しました" };
  }
}

/**
 * 症状の確認通知（`symptom_ongoing`）に「解消した」と答えたときに呼ぶ。通知を完了にすると
 * 同時に、対象の症状記録の状態を「解消」に更新する（`resolveSymptomNotification`）
 */
export async function resolveSymptomNotificationAction(
  id: string,
): Promise<NotificationActionResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    switch (await resolveSymptomNotification(user.id, id)) {
      case "resolved":
        return {};
      case "not-found":
        return { error: "通知が見つかりませんでした" };
      case "symptom-not-found":
        return {
          error:
            "症状の記録が見つかりませんでした。「無視する」で通知を閉じてください",
        };
    }
  } catch (error) {
    console.error("症状の解消と通知の完了処理に失敗しました", error);
    return { error: "症状の解消と通知の完了処理に失敗しました" };
  }
}

export async function dismissNotificationAction(
  id: string,
): Promise<NotificationActionResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    await dismissNotification(user.id, id);
    return {};
  } catch (error) {
    console.error("通知の無視処理に失敗しました", error);
    return { error: "通知の無視処理に失敗しました" };
  }
}

/** 通知を延期する（`snoozeNotification`） */
export async function snoozeNotificationAction(
  id: string,
  snoozedUntil: Date,
): Promise<NotificationActionResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    if (!(await snoozeNotification(user.id, id, snoozedUntil))) {
      return { error: "通知が見つかりませんでした" };
    }
    return {};
  } catch (error) {
    console.error("通知の延期処理に失敗しました", error);
    return { error: "通知の延期処理に失敗しました" };
  }
}

/** 通知センターを開いた時点で、表示中の未対応通知をまとめて既読にする */
export async function markNotificationsReadAction(
  ids: string[],
): Promise<NotificationActionResult> {
  const user = await requireUser();
  if (ids.length === 0) {
    return {};
  }
  try {
    await markNotificationsRead(user.id, ids);
    return {};
  } catch (error) {
    console.error("通知の既読処理に失敗しました", error);
    return { error: "通知の既読処理に失敗しました" };
  }
}
