import { toPushSubscriptionKeys } from "../domain/pushSubscription";
import type { RequestTestPushResult } from "../domain/pushSubscriptionRepository";
import type { PushSubscribeInput } from "../domain/subscriptionSchema";
import { createPushSubscriptionRepository } from "../infrastructure/pushSubscriptionRepository";

/*
 * Push 購読の登録・解除（ユースケース）。ユーザーはログイン中のユーザー（呼び出し側で確かめる）
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
  await createPushSubscriptionRepository(d1).saveForUser(
    userId,
    toPushSubscriptionKeys(input),
  );
}

/** ユーザーの購読（とユーザーに紐付く前の購読）だけを解除する */
export async function unsubscribeFromPush(
  userId: string,
  endpoint: string,
  d1?: D1Database,
): Promise<void> {
  await createPushSubscriptionRepository(d1).removeForUser(userId, endpoint);
}

/** この端末（`endpoint`）へのテスト通知を予約する */
export function requestTestPushForUser(
  userId: string,
  endpoint: string,
  d1?: D1Database,
): Promise<RequestTestPushResult> {
  return createPushSubscriptionRepository(d1).requestTestPush(userId, endpoint);
}
