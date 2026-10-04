"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { pushSubscribeSchema } from "./subscriptionSchema";

export type PushSubscriptionActionResult = { error?: string };

/**
 * クライアントの `pushManager.subscribe()` の結果を、ログイン中のユーザーの購読として登録する。
 * 購読には、そのユーザーの家の猫の通知だけを送る。フォームではなく
 * クライアントコンポーネント（`PushSubscriptionToggle`）から直接呼ぶ Server Action
 */
export async function subscribeToPushAction(
  input: unknown,
): Promise<PushSubscriptionActionResult> {
  const user = await requireUser();
  const parsed = pushSubscribeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "購読情報が正しくありません" };
  }

  try {
    const db = getDb();
    await db
      .insert(pushSubscriptions)
      .values({
        userId: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        userAgent: parsed.data.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        // 同じ端末で別のユーザーが購読し直した場合は、そのユーザーの購読にする
        set: {
          userId: user.id,
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

/** ログイン中のユーザーの購読（とユーザーに紐付く前の購読）だけを解除する */
export async function unsubscribeFromPushAction(
  endpoint: string,
): Promise<PushSubscriptionActionResult> {
  const user = await requireUser();
  try {
    const db = getDb();
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          or(
            eq(pushSubscriptions.userId, user.id),
            isNull(pushSubscriptions.userId),
          ),
        ),
      );
    return {};
  } catch (error) {
    console.error("Push購読の解除に失敗しました", error);
    return { error: "Push購読の解除に失敗しました" };
  }
}
