import type { PushSubscription } from "@/db/schema";
import type { PushSubscribeInput } from "./subscriptionSchema";

/** 端末の Push 購読（エンティティ）。端末（`endpoint`）ごとに 1 件で、ユーザーに属する */
export type { PushSubscription };

/** 購読の鍵と端末の情報。ユーザー・送信の失敗回数などを除いたもの */
export type PushSubscriptionKeys = Pick<
  PushSubscription,
  "endpoint" | "p256dh" | "auth" | "userAgent"
>;

/** 入力から購読の鍵と端末の情報を作る */
export function toPushSubscriptionKeys(
  input: PushSubscribeInput,
): PushSubscriptionKeys {
  return {
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent ?? null,
  };
}
