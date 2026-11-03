import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { requestTestPush } from "./sendTestPush";
import type { PushSubscribeInput } from "./subscriptionSchema";

/*
 * Push 購読の登録・解除。ユーザーはログイン中のユーザー（呼び出し側で確かめる）
 */

/**
 * 端末の購読を、ユーザーの購読として登録する。同じ端末（endpoint）で別のユーザーが
 * 購読し直した場合は、そのユーザーの購読にする
 */
export async function subscribeToPush(
  userId: string,
  input: PushSubscribeInput,
  d1?: D1Database,
): Promise<void> {
  await getDb(d1)
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      // 同じ端末で別のユーザーが購読し直した場合は、そのユーザーの購読にする
      set: {
        userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        failureCount: 0,
      },
    });
}

/** ユーザーの購読（とユーザーに紐付く前の購読）だけを解除する */
export async function unsubscribeFromPush(
  userId: string,
  endpoint: string,
  d1?: D1Database,
): Promise<void> {
  await getDb(d1)
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
}

/** この端末（`endpoint`）へのテスト通知を予約する（`requestTestPush`） */
export function requestTestPushForUser(
  userId: string,
  endpoint: string,
  d1?: D1Database,
) {
  return requestTestPush(getDb(d1), userId, endpoint);
}
