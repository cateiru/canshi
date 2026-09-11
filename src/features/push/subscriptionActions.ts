"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { pushSubscribeSchema } from "./subscriptionSchema";

export type PushSubscriptionActionResult = { error?: string };

/**
 * クライアントの `pushManager.subscribe()` の結果を登録する。フォームではなく
 * クライアントコンポーネント（`PushSubscriptionToggle`）から直接呼ぶ Server Action
 */
export async function subscribeToPushAction(
  input: unknown,
): Promise<PushSubscriptionActionResult> {
  const parsed = pushSubscribeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "購読情報が正しくありません" };
  }

  try {
    const db = getDb();
    await db
      .insert(pushSubscriptions)
      .values({
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userAgent: parsed.data.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: parsed.data.p256dh,
          auth: parsed.data.auth,
          userAgent: parsed.data.userAgent ?? null,
          failureCount: 0,
        },
      });
    return {};
  } catch (error) {
    console.error("Push購読の登録に失敗しました", error);
    return { error: "Push購読の登録に失敗しました" };
  }
}

export async function unsubscribeFromPushAction(
  endpoint: string,
): Promise<PushSubscriptionActionResult> {
  try {
    const db = getDb();
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return {};
  } catch (error) {
    console.error("Push購読の解除に失敗しました", error);
    return { error: "Push購読の解除に失敗しました" };
  }
}
