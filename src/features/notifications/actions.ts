"use server";

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notifications, pushDeliveries } from "@/db/schema";

export type NotificationActionResult = { error?: string };

/** 通知センター（`30`）から呼ばれる想定の Server Action。結果は戻り値で返す */
export async function markNotificationDoneAction(
  id: string,
): Promise<NotificationActionResult> {
  try {
    const db = getDb();
    await db
      .update(notifications)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(notifications.id, id));
    return {};
  } catch (error) {
    console.error("通知の完了処理に失敗しました", error);
    return { error: "通知の完了処理に失敗しました" };
  }
}

export async function dismissNotificationAction(
  id: string,
): Promise<NotificationActionResult> {
  try {
    const db = getDb();
    await db
      .update(notifications)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(eq(notifications.id, id));
    return {};
  } catch (error) {
    console.error("通知の無視処理に失敗しました", error);
    return { error: "通知の無視処理に失敗しました" };
  }
}

/**
 * 通知を延期する。`snoozedUntil` の到来後は `status` を書き換えなくても未対応として扱われる
 * （`src/features/notifications/status.ts` の `isNotificationPending` 参照）。
 * 延期後の再通知のため `readAt`・`pushedAt` もあわせて未対応状態へ戻す。
 * `push_deliveries` の行（`29` の送信済み記録）も削除しないと、`pushedAt` を null に
 * 戻しても Workflow が「この購読へは送信済み」と判断して再送しない（`src/workflows/notification.ts`
 * の `delivered` 参照）ため、期日到来後に Push が届かなくなる
 */
export async function snoozeNotificationAction(
  id: string,
  snoozedUntil: Date,
): Promise<NotificationActionResult> {
  try {
    const db = getDb();
    await db.batch([
      db
        .update(notifications)
        .set({
          status: "snoozed",
          snoozedUntil,
          readAt: null,
          pushedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(notifications.id, id)),
      db.delete(pushDeliveries).where(eq(pushDeliveries.notificationId, id)),
    ]);
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
  if (ids.length === 0) {
    return {};
  }
  try {
    const db = getDb();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(inArray(notifications.id, ids));
    return {};
  } catch (error) {
    console.error("通知の既読処理に失敗しました", error);
    return { error: "通知の既読処理に失敗しました" };
  }
}
