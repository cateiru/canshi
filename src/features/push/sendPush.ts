import {
  type PushSubscription as BlockPushSubscription,
  buildPushPayload,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import { eq } from "drizzle-orm";
import type { getDb } from "@/db/client";
import type { Notification, PushSubscription } from "@/db/schema";
import { pushSubscriptions } from "@/db/schema";
import { MAX_PUSH_FAILURE_COUNT, PUSH_MESSAGE_TTL_SECONDS } from "./defaults";

/**
 * 1件の通知を1件の購読へ送信する。
 *
 * `fetch` 自体が失敗する（DNS・タイムアウト等の一時的なネットワークエラー）場合は
 * 例外をそのまま投げる。呼び出し側（`src/workflows/notification.ts`）の Workflow
 * ステップのリトライで吸収する想定のため、ここでは揉み消さない。
 *
 * 一方、プッシュサービスから応答があった場合（`404`／`410` やその他のエラー）は
 * 一時的な障害ではなく確定した結果として扱う： `404`／`410` を返した購読は削除し、
 * それ以外の失敗は `failureCount` を加算して、上限を超えたら削除する。
 * 成功時は `lastUsedAt` を更新し `failureCount` をリセットする
 */
export async function sendPushToSubscription(
  db: ReturnType<typeof getDb>,
  subscription: PushSubscription,
  notification: Notification,
  vapid: VapidKeys,
): Promise<void> {
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
      data: {
        title: notification.title,
        body: notification.body,
        url: notification.url,
      },
      options: { ttl: PUSH_MESSAGE_TTL_SECONDS },
    },
    pushSubscription,
    vapid,
  );
  const res = await fetch(subscription.endpoint, payload);

  if (res.status === 404 || res.status === 410) {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
    return;
  }

  if (res.ok) {
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date(), failureCount: 0 })
      .where(eq(pushSubscriptions.id, subscription.id));
    return;
  }

  const nextFailureCount = subscription.failureCount + 1;
  if (nextFailureCount >= MAX_PUSH_FAILURE_COUNT) {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));
  } else {
    await db
      .update(pushSubscriptions)
      .set({ failureCount: nextFailureCount })
      .where(eq(pushSubscriptions.id, subscription.id));
  }
}
