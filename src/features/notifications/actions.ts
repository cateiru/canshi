"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cleaningRecords,
  cleaningTargets,
  notifications,
  pushDeliveries,
  symptoms,
} from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { accessibleCatIdsQuery } from "@/features/households/queries";
import { getNaiveUtcNow } from "@/features/shared/datetime";

export type NotificationActionResult = { error?: string };

/**
 * 指定した ID の通知のうち、ユーザーの家の猫の通知だけに一致する条件。
 * 別の家の猫の通知は、存在しない通知と同じく更新対象にしない
 */
function accessibleNotification(
  db: ReturnType<typeof getDb>,
  userId: string,
  id: string,
) {
  return and(
    eq(notifications.id, id),
    inArray(notifications.catId, accessibleCatIdsQuery(db, userId)),
  );
}

/** 通知センター（`30`）から呼ばれる想定の Server Action。結果は戻り値で返す */
export async function markNotificationDoneAction(
  id: string,
): Promise<NotificationActionResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    const db = getDb();
    await db
      .update(notifications)
      .set({ status: "done", updatedAt: new Date() })
      .where(accessibleNotification(db, user.id, id));
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
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
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
      .where(accessibleNotification(db, user.id, id))
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

    // 無効化済みの掃除対象は編集・記録閲覧のみが仕様のため新規登録は拒否する。
    // 対象の削除時は通知も削除される（`src/features/cleaning/targetActions.ts`）が、
    // 無効化では未対応の通知が残るため、「無視する」で閉じられるよう案内する
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
      return {
        error:
          "掃除対象が無効になっているため記録できません。「無視する」で通知を閉じてください",
      };
    }

    // 上の完了判定はバッチ外の読み取りのため、別タブ・別端末から同じ通知を同時に完了すると
    // 両方が未完了と判断しうる。記録の追加を「通知が未完了なら」という条件付きの
    // INSERT ... SELECT にし、完了への更新と同じバッチ（D1 では 1 トランザクション）で
    // 実行することで、後から実行されたバッチでは記録が追加されないようにする。
    // INSERT ... SELECT では `$defaultFn` が効かないため、全カラムの値を明示する
    await db.batch([
      db.insert(cleaningRecords).select(
        db
          .select({
            id: sql`${crypto.randomUUID()}`.as("id"),
            catId: notifications.catId,
            cleaningTargetId: cleaningTargets.id,
            performedAt:
              sql`${sql.param(getNaiveUtcNow(), cleaningRecords.performedAt)}`.as(
                "performedAt",
              ),
            memo: sql`null`.as("memo"),
            createdAt: sql`(unixepoch())`.as("createdAt"),
            updatedAt: sql`(unixepoch())`.as("updatedAt"),
          })
          .from(notifications)
          .innerJoin(
            cleaningTargets,
            and(
              eq(cleaningTargets.id, notifications.referenceId),
              eq(cleaningTargets.catId, notifications.catId),
            ),
          )
          .where(
            and(
              eq(notifications.id, id),
              ne(notifications.status, "done"),
              eq(cleaningTargets.isActive, true),
            ),
          ),
      ),
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

/**
 * 症状の確認通知（`symptom_ongoing`）に「解消した」と答えたときに呼ぶ。通知を完了にすると
 * 同時に、対象の症状記録の状態を「解消」に更新する。2つの更新は同じバッチ（D1 では
 * 1 トランザクション）で実行し、片方だけが反映されないようにする
 */
export async function resolveSymptomNotificationAction(
  id: string,
): Promise<NotificationActionResult> {
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    const db = getDb();
    const [notification] = await db
      .select({
        catId: notifications.catId,
        kind: notifications.kind,
        referenceId: notifications.referenceId,
      })
      .from(notifications)
      .where(accessibleNotification(db, user.id, id))
      .limit(1);

    if (
      notification?.kind !== "symptom_ongoing" ||
      notification.referenceId == null
    ) {
      return { error: "通知が見つかりませんでした" };
    }

    const [symptom] = await db
      .select({ id: symptoms.id })
      .from(symptoms)
      .where(
        and(
          eq(symptoms.id, notification.referenceId),
          eq(symptoms.catId, notification.catId),
        ),
      )
      .limit(1);

    if (!symptom) {
      return {
        error:
          "症状の記録が見つかりませんでした。「無視する」で通知を閉じてください",
      };
    }

    await db.batch([
      db
        .update(symptoms)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(
          and(
            eq(symptoms.id, symptom.id),
            eq(symptoms.catId, notification.catId),
            ne(symptoms.status, "resolved"),
          ),
        ),
      db
        .update(notifications)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(notifications.id, id)),
    ]);
    return {};
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
    const db = getDb();
    await db
      .update(notifications)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(accessibleNotification(db, user.id, id));
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
  // requireUser は未ログイン時にリダイレクト（例外）するため、try の外で呼ぶ
  const user = await requireUser();
  try {
    const db = getDb();
    const [notification] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(accessibleNotification(db, user.id, id))
      .limit(1);
    if (!notification) {
      return { error: "通知が見つかりませんでした" };
    }
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
  const user = await requireUser();
  if (ids.length === 0) {
    return {};
  }
  try {
    const db = getDb();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          inArray(notifications.id, ids),
          inArray(notifications.catId, accessibleCatIdsQuery(db, user.id)),
        ),
      );
    return {};
  } catch (error) {
    console.error("通知の既読処理に失敗しました", error);
    return { error: "通知の既読処理に失敗しました" };
  }
}
