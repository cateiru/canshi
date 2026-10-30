import {
  type PushSubscription as BlockPushSubscription,
  buildPushPayload,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import { eq } from "drizzle-orm";
import type { getDb } from "@/db/client";
import type { Notification, PushSubscription } from "@/db/schema";
import { pushDeliveries, pushSubscriptions } from "@/db/schema";
import { MAX_PUSH_FAILURE_COUNT, PUSH_MESSAGE_TTL_SECONDS } from "./defaults";

/**
 * `sendPushToSubscription` の結果。呼び出し側（`src/workflows/notification.ts`）は
 * この型を見て、通知を送信済みとして扱ってよいか・購読を再試行対象から外してよいかを判断する。
 * - `sent`：送信成功。`(notification_id, subscription_id)` を `push_deliveries` に記録済み
 * - `removed`：`404`／`410`、または失敗上限到達により購読を削除した（この購読への再試行は不要）
 * - `retriable`：`429`／`5xx` の一時的な応答。`failureCount` は変更していないので、
 *   呼び出し側で例外にして Workflow のステップリトライに委ねること
 * - `failed`：上記以外の確定した失敗。`failureCount` を加算済み（上限未満のため購読は残っている）
 */
export type PushSendResult =
  | { outcome: "sent" }
  | { outcome: "removed" }
  | { outcome: "retriable"; status: number }
  | { outcome: "failed"; status: number };

/** Service Worker（`public/sw.js`）の `push` イベントが受け取る通知の中身 */
export type PushMessage = { title: string; body: string; url: string };

/**
 * 1件の購読へ通知の中身を暗号化して送り、プッシュサービスの応答をそのまま返す。
 * DB の購読・送信記録は変更しないので、応答の扱いは呼び出し側で決める
 */
export async function postPushMessage(
  subscription: Pick<PushSubscription, "endpoint" | "p256dh" | "auth">,
  message: PushMessage,
  vapid: VapidKeys,
): Promise<Response> {
  const pushSubscription: BlockPushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const payload = await buildPushPayload(
    {
      data: message,
      options: { ttl: PUSH_MESSAGE_TTL_SECONDS },
    },
    pushSubscription,
    vapid,
  );
  return fetch(subscription.endpoint, payload);
}

/**
 * プッシュサービスの応答に応じて購読を更新し、結果を返す。
 *
 * - `404`／`410` は購読自体が無効になったという確定した結果なので、購読を削除する
 * - `429`／`5xx` は一時的な応答なので `failureCount` を変更せず `retriable` を返す。
 *   ここで `failureCount` を加算して正常終了すると、Workflow のステップリトライが
 *   一度も使われないまま「処理済み」になってしまうため
 * - それ以外の失敗は確定した結果として `failureCount` を加算し、上限を超えたら削除する
 * - 成功時は `lastUsedAt` を更新して `failureCount` をリセットする
 */
export async function applyPushResponse(
  db: ReturnType<typeof getDb>,
  subscription: Pick<PushSubscription, "id" | "failureCount">,
  res: Response,
): Promise<PushSendResult> {
  if (res.status === 404 || res.status === 410) {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    return { outcome: "removed" };
  }

  if (res.ok) {
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date(), failureCount: 0 })
      .where(eq(pushSubscriptions.id, subscription.id));
    return { outcome: "sent" };
  }

  if (res.status === 429 || res.status >= 500) {
    return { outcome: "retriable", status: res.status };
  }

  const nextFailureCount = subscription.failureCount + 1;
  if (nextFailureCount >= MAX_PUSH_FAILURE_COUNT) {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    return { outcome: "removed" };
  }

  await db
    .update(pushSubscriptions)
    .set({ failureCount: nextFailureCount })
    .where(eq(pushSubscriptions.id, subscription.id));
  return { outcome: "failed", status: res.status };
}

/**
 * 1件の通知を1件の購読へ送信する。
 *
 * `fetch` 自体が失敗する（DNS・タイムアウト等の一時的なネットワークエラー）場合は
 * 例外をそのまま投げる。呼び出し側の Workflow ステップのリトライで吸収する想定のため、
 * ここでは揉み消さない。
 *
 * プッシュサービスの応答の扱いは `applyPushResponse` のとおり。成功時は、さらに
 * `push_deliveries` にこの通知・購読の組み合わせを記録する
 */
export async function sendPushToSubscription(
  db: ReturnType<typeof getDb>,
  subscription: PushSubscription,
  notification: Notification,
  vapid: VapidKeys,
): Promise<PushSendResult> {
  const res = await postPushMessage(
    subscription,
    {
      title: notification.title,
      body: notification.body,
      url: notification.url,
    },
    vapid,
  );

  const result = await applyPushResponse(db, subscription, res);
  if (result.outcome === "sent") {
    await db
      .insert(pushDeliveries)
      .values({
        notificationId: notification.id,
        subscriptionId: subscription.id,
      })
      .onConflictDoNothing();
  }
  return result;
}
