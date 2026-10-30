import type { VapidKeys } from "@block65/webcrypto-web-push";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PushSubscription } from "@/db/schema";
import { pushSubscriptions, pushTestRequests } from "@/db/schema";
import { PUSH_SCHEDULE_INTERVAL_MINUTES } from "./defaults";
import {
  applyPushResponse,
  type PushMessage,
  type PushSendResult,
  postPushMessage,
} from "./sendPush";

/** テスト通知の中身。猫の名前などは含めない */
export const TEST_PUSH_MESSAGE: PushMessage = {
  title: "テスト通知",
  body: "CANSHI からのお知らせは、この端末にこのように届きます。",
  url: "/settings/notifications",
};

/**
 * `now` の次のスケジュール実行の時刻。Cron は UTC の 15 分区切りで動き、日本時間とのずれは
 * 9 時間ちょうどなので、Unix 時刻を 15 分で切り上げた時刻がそのまま実行時刻になる。
 * 区切りちょうどに予約した場合は、その回の実行に間に合わない可能性があるため次の回とする
 */
export function nextScheduledRunAt(now: Date): Date {
  const interval = PUSH_SCHEDULE_INTERVAL_MINUTES * 60 * 1000;
  return new Date(Math.floor(now.getTime() / interval) * interval + interval);
}

/**
 * ユーザーの購読（`endpoint`）へのテスト通知を予約する。別のユーザーの購読には予約できない。
 * 同じ端末で予約し直した場合は、予約した日時だけを更新する
 */
export async function requestTestPush(
  db: ReturnType<typeof getDb>,
  userId: string,
  endpoint: string,
): Promise<{ outcome: "requested" } | { outcome: "not-subscribed" }> {
  const [subscription] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, userId),
      ),
    );
  if (!subscription) {
    return { outcome: "not-subscribed" };
  }

  await db
    .insert(pushTestRequests)
    .values({ subscriptionId: subscription.id })
    .onConflictDoUpdate({
      target: pushTestRequests.subscriptionId,
      set: { requestedAt: new Date() },
    });
  return { outcome: "requested" };
}

/** 予約されたテスト通知と、その送り先の購読 */
export type PushTestTarget = {
  requestId: string;
  subscription: PushSubscription;
};

/** 予約されたテスト通知の一覧（`src/workflows/notification.ts` から呼ぶ） */
export async function listPushTestTargets(
  d1?: D1Database,
): Promise<PushTestTarget[]> {
  const db = getDb(d1);
  return db
    .select({
      requestId: pushTestRequests.id,
      subscription: pushSubscriptions,
    })
    .from(pushTestRequests)
    .innerJoin(
      pushSubscriptions,
      eq(pushSubscriptions.id, pushTestRequests.subscriptionId),
    );
}

/**
 * 予約されたテスト通知を送る。応答の扱いは通常の通知と同じ（`applyPushResponse`）で、
 * `retriable` 以外では予約を削除する。`retriable` のときは予約を残すので、
 * 呼び出し側でステップのリトライに委ね、リトライし尽くしたら次のスケジュール実行で送り直す。
 * `fetch` 自体の失敗も、予約を残したまま例外をそのまま投げる
 */
export async function sendTestPush(
  db: ReturnType<typeof getDb>,
  target: PushTestTarget,
  vapid: VapidKeys,
): Promise<PushSendResult> {
  const res = await postPushMessage(
    target.subscription,
    TEST_PUSH_MESSAGE,
    vapid,
  );
  const result = await applyPushResponse(db, target.subscription, res);
  if (result.outcome !== "retriable") {
    // 購読を削除した場合は cascade で予約も消えるが、外部キーの制約に頼らず明示的に消す
    await db
      .delete(pushTestRequests)
      .where(eq(pushTestRequests.id, target.requestId));
  }
  return result;
}
