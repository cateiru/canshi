import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  cleaningRecords,
  cleaningTargets,
  notifications,
  pushDeliveries,
  symptoms,
} from "@/db/schema";
import { getNaiveUtcNow } from "@/features/shared/datetime";
import {
  ACCESSIBLE_NOTIFICATIONS_CONDITION_PARAMETERS,
  accessibleNotificationsCondition,
} from "../infrastructure/access";

/*
 * 通知センター（`30`）の操作。ユーザーが参照できる通知（ユーザーの家の猫・ユーザーの家の通知）
 * だけを対象にする。結果をどう伝えるかは呼び出し側（`./actions.ts`）で決める
 */

/**
 * 指定した ID の通知のうち、ユーザーが参照できる通知（ユーザーの家の猫・ユーザーの家の通知）
 * だけに一致する条件。別の家の通知は、存在しない通知と同じく更新対象にしない
 */
function accessibleNotification(
  db: ReturnType<typeof getDb>,
  userId: string,
  id: string,
) {
  return and(
    eq(notifications.id, id),
    accessibleNotificationsCondition(db, userId),
  );
}

/** 通知を完了にする。参照できない・存在しない通知では何もしない */
export async function markNotificationDone(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<void> {
  const db = getDb(d1);
  await db
    .update(notifications)
    .set({ status: "done", updatedAt: new Date() })
    .where(accessibleNotification(db, userId, id));
}

export type MarkCleaningNotificationDoneResult =
  | "done"
  | "not-found"
  | "target-inactive";

/**
 * 掃除の通知（`cleaning_due`）を完了にすると同時に、その掃除対象へ「今すぐ掃除した」
 * 記録を追加する。記録は `src/features/cleaning/recordMutations.ts` の
 * `createCleaningRecordNow` と同じく naive UTC の現在時刻で登録する。
 * 完了済みの通知に対しては記録を追加しない（連打などによる二重記録を防ぐ）
 */
export async function markCleaningNotificationDone(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<MarkCleaningNotificationDoneResult> {
  const db = getDb(d1);
  const [notification] = await db
    .select({
      catId: notifications.catId,
      kind: notifications.kind,
      referenceId: notifications.referenceId,
      status: notifications.status,
    })
    .from(notifications)
    .where(accessibleNotification(db, userId, id))
    .limit(1);

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
  // 対象の削除時は通知も削除される（`src/features/cleaning/targetMutations.ts`）が、
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
    return "target-inactive";
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
  return "done";
}

export type ResolveSymptomNotificationResult =
  | "resolved"
  | "not-found"
  | "symptom-not-found";

/**
 * 症状の確認通知（`symptom_ongoing`）に「解消した」と答えたときに呼ぶ。通知を完了にすると
 * 同時に、対象の症状記録の状態を「解消」に更新する。2つの更新は同じバッチ（D1 では
 * 1 トランザクション）で実行し、片方だけが反映されないようにする
 */
export async function resolveSymptomNotification(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<ResolveSymptomNotificationResult> {
  const db = getDb(d1);
  const [notification] = await db
    .select({
      catId: notifications.catId,
      kind: notifications.kind,
      referenceId: notifications.referenceId,
    })
    .from(notifications)
    .where(accessibleNotification(db, userId, id))
    .limit(1);

  if (
    notification?.kind !== "symptom_ongoing" ||
    notification.referenceId == null ||
    notification.catId == null
  ) {
    return "not-found";
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
    return "symptom-not-found";
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
  return "resolved";
}

/** 通知を無視する。参照できない・存在しない通知では何もしない */
export async function dismissNotification(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<void> {
  const db = getDb(d1);
  await db
    .update(notifications)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(accessibleNotification(db, userId, id));
}

/**
 * 通知を延期する。参照できない・存在しない通知なら false。
 * `snoozedUntil` の到来後は `status` を書き換えなくても未対応として扱われる
 * （`src/features/notifications/status.ts` の `isNotificationPending` 参照）。
 * 延期後の再通知のため `readAt`・`pushedAt` もあわせて未対応状態へ戻す。
 * `push_deliveries` の行（`29` の送信済み記録）も削除しないと、`pushedAt` を null に
 * 戻しても Workflow が「この購読へは送信済み」と判断して再送しない（`src/workflows/notification.ts`
 * の `delivered` 参照）ため、期日到来後に Push が届かなくなる
 */
export async function snoozeNotification(
  userId: string,
  id: string,
  snoozedUntil: Date,
  d1?: D1Database,
): Promise<boolean> {
  const db = getDb(d1);
  const [notification] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(accessibleNotification(db, userId, id))
    .limit(1);
  if (!notification) {
    return false;
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
  return true;
}

/** 指定した通知のうち、ユーザーが参照できるものをまとめて既読にする */
export async function markNotificationsRead(
  userId: string,
  ids: string[],
  d1?: D1Database,
): Promise<void> {
  const db = getDb(d1);
  const readAt = new Date();
  // `set` の既読日時（1 個）と `accessibleNotificationsCondition` の userId の分を予約する
  for (const chunk of chunkForBoundParameters(
    ids,
    1 + ACCESSIBLE_NOTIFICATIONS_CONDITION_PARAMETERS,
  )) {
    await db
      .update(notifications)
      .set({ readAt })
      .where(
        and(
          inArray(notifications.id, chunk),
          accessibleNotificationsCondition(db, userId),
        ),
      );
  }
}
