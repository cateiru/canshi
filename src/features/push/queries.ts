import { and, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cats,
  householdMembers,
  notifications,
  pushDeliveries,
  pushSubscriptions,
} from "@/db/schema";
import type { UserCatAccess } from "./targets";

/** 通知を送りうる購読（ユーザーに紐付いたもの）の一覧 */
export async function listPushSubscriptions(d1?: D1Database) {
  const db = getDb(d1);
  return db
    .select()
    .from(pushSubscriptions)
    .where(isNotNull(pushSubscriptions.userId));
}

/**
 * 購読しているユーザーと、そのユーザーが参照できる猫（所属する家の猫）の組の一覧。
 * 通知ごとの送り先を `selectPushTargets`（`./targets`）で絞り込むために使う
 */
export async function listCatAccessesOfSubscribers(
  d1?: D1Database,
): Promise<UserCatAccess[]> {
  const db = getDb(d1);
  return db
    .selectDistinct({ userId: householdMembers.userId, catId: cats.id })
    .from(householdMembers)
    .innerJoin(cats, eq(cats.householdId, householdMembers.householdId))
    .where(
      inArray(
        householdMembers.userId,
        db
          .select({ userId: pushSubscriptions.userId })
          .from(pushSubscriptions)
          .where(isNotNull(pushSubscriptions.userId)),
      ),
    );
}

/**
 * 指定した通知に対して、すでに送信が完了している (notification_id, subscription_id) の組。
 * 前回のスケジュール実行で一部の購読だけ送信できた通知を再試行する際、成功済みの購読へ
 * 重複送信しないために使う（`src/workflows/notification.ts` 参照）
 */
export async function listPushDeliveries(
  notificationIds: string[],
  d1?: D1Database,
) {
  if (notificationIds.length === 0) {
    return [];
  }
  const db = getDb(d1);
  return db
    .select({
      notificationId: pushDeliveries.notificationId,
      subscriptionId: pushDeliveries.subscriptionId,
    })
    .from(pushDeliveries)
    .where(inArray(pushDeliveries.notificationId, notificationIds));
}

/**
 * まだ Push 送信していない（`pushed_at` が NULL）未対応の通知一覧。
 * `src/features/notifications/queries.ts` の `listPendingNotifications` と同じ
 * 未対応判定に、送信済みかどうかの条件を加えたもの
 */
export async function listUnpushedNotifications(now: Date, d1?: D1Database) {
  const db = getDb(d1);
  return db
    .select()
    .from(notifications)
    .where(
      and(
        isNull(notifications.pushedAt),
        or(
          eq(notifications.status, "pending"),
          and(
            eq(notifications.status, "snoozed"),
            lte(notifications.snoozedUntil, now),
          ),
        ),
      ),
    );
}
