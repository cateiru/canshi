"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { nextScheduledRunAt, requestTestPush } from "./sendTestPush";
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

export type TestPushActionResult =
  | { error: string }
  // 次のスケジュール実行の時刻（ISO 8601）。この時刻ごろにテスト通知が届く
  | { scheduledAt: string };

/**
 * この端末（`endpoint`）へのテスト通知を、次のスケジュール実行で送るよう予約する。
 * 通常の通知と同じ経路（`src/workflows/notification.ts`）で送るため、すぐには届かない
 */
export async function requestTestPushAction(
  endpoint: string,
): Promise<TestPushActionResult> {
  const user = await requireUser();
  try {
    const result = await requestTestPush(getDb(), user.id, endpoint);
    if (result.outcome === "not-subscribed") {
      return {
        error:
          "この端末の通知の登録が見つかりませんでした。通知を一度オフにしてから、もう一度オンにしてください",
      };
    }
    return { scheduledAt: nextScheduledRunAt(new Date()).toISOString() };
  } catch (error) {
    console.error("テスト通知の予約に失敗しました", error);
    return { error: "テスト通知の予約に失敗しました" };
  }
}
