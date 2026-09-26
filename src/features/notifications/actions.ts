"use server";

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cleaningRecords,
  cleaningTargets,
  notifications,
  pushDeliveries,
} from "@/db/schema";
import { getNaiveUtcNow } from "@/features/shared/datetime";

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

/**
 * 掃除の通知（`cleaning_due`）を完了にすると同時に、その掃除対象へ「今すぐ掃除した」
 * 記録を追加する。記録は `src/features/cleaning/recordActions.ts` の
 * `quickCreateCleaningRecordAction` と同じく naive UTC の現在時刻で登録する。
 * 完了済みの通知に対しては記録を追加しない（連打などによる二重記録を防ぐ）
 */
export async function markCleaningNotificationDoneAction(
  id: string,
): Promise<NotificationActionResult> {
  try {
    const db = getDb();
    const [notification] = await db
      .select({
        catId: notifications.catId,
        kind: notifications.kind,
        referenceId: notifications.referenceId,
        status: notifications.status,
      })
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (
      notification?.kind !== "cleaning_due" ||
      notification.referenceId == null
    ) {
      return { error: "通知が見つかりませんでした" };
    }
    if (notification.status === "done") {
      return {};
    }

    // 無効化済みの掃除対象は編集・記録閲覧のみが仕様のため新規登録は拒否する
    const [target] = await db
      .select({ id: cleaningTargets.id })
      .from(cleaningTargets)
      .where(
        and(
          eq(cleaningTargets.id, notification.referenceId),
          eq(cleaningTargets.catId, notification.catId),
          eq(cleaningTargets.isActive, true),
        ),
      )
      .limit(1);

    if (!target) {
      return { error: "掃除対象が見つかりませんでした" };
    }

    await db.batch([
      db.insert(cleaningRecords).values({
        catId: notification.catId,
        cleaningTargetId: target.id,
        performedAt: getNaiveUtcNow(),
      }),
      db
        .update(notifications)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(notifications.id, id)),
    ]);
    return {};
  } catch (error) {
    console.error("掃除記録の追加と通知の完了処理に失敗しました", error);
    return { error: "掃除記録の追加と通知の完了処理に失敗しました" };
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
