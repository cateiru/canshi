import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import type { PushSubscriptionRepository } from "../domain/pushSubscriptionRepository";
import { requestTestPush } from "./sendTestPush";

/** D1 に保存する `PushSubscriptionRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createPushSubscriptionRepository(
  d1?: D1Database,
): PushSubscriptionRepository {
  const db = getDb(d1);
  return {
    async saveForUser(userId, keys) {
      await db
        .insert(pushSubscriptions)
        .values({ userId, ...keys })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          // 同じ端末で別のユーザーが購読し直した場合は、そのユーザーの購読にする
          set: {
            userId,
            p256dh: keys.p256dh,
            auth: keys.auth,
            userAgent: keys.userAgent,
            failureCount: 0,
          },
        });
    },
    async removeForUser(userId, endpoint) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, endpoint),
            or(
              eq(pushSubscriptions.userId, userId),
              isNull(pushSubscriptions.userId),
            ),
          ),
        );
    },
    requestTestPush(userId, endpoint) {
      return requestTestPush(db, userId, endpoint);
    },
  };
}
