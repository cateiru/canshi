import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notifications } from "@/db/schema";
import { generateNotifications } from "@/features/notifications/generate";
import {
  listPushDeliveries,
  listPushSubscriptions,
  listUnpushedNotifications,
} from "@/features/push/queries";
import { sendPushToSubscription } from "@/features/push/sendPush";
import { getVapidKeys } from "@/features/push/vapid";

function deliveryKey(notificationId: string, subscriptionId: string): string {
  return `${notificationId}:${subscriptionId}`;
}

type NotificationWorkflowParams = Record<string, never>;

/**
 * `29` のスケジュール実行本体。`worker.ts` の `scheduled` ハンドラから 15 分ごとに
 * インスタンスが作られる（`wrangler.toml` の `[triggers]`）。
 *
 * Workflow のステップはリクエストの外で実行されるため `getCloudflareContext()`
 * （`src/db/client.ts` の `getDb()` が内部で使う）が使えない。そのため、この
 * Workflow だけは自身の `this.env.DB` を明示的に渡す
 */
export class NotificationWorkflow extends WorkflowEntrypoint<
  Env,
  NotificationWorkflowParams
> {
  async run(
    event: WorkflowEvent<NotificationWorkflowParams>,
    step: WorkflowStep,
  ): Promise<void> {
    const now = event.timestamp;

    await step.do("generate notifications", async () => {
      await generateNotifications(now, this.env.DB);
    });

    const vapid = getVapidKeys(this.env);
    if (!vapid) {
      // VAPID 鍵が未設定の環境（鍵未生成のローカル環境など）では、通知の生成だけ行い
      // Push 送信はスキップする
      return;
    }

    const { pending, subscriptions } = await step.do(
      "list pending pushes",
      async () => {
        const [pending, subscriptions] = await Promise.all([
          listUnpushedNotifications(now, this.env.DB),
          listPushSubscriptions(this.env.DB),
        ]);
        return { pending, subscriptions };
      },
    );

    if (pending.length === 0 || subscriptions.length === 0) {
      return;
    }

    // 前回の実行で一部の購読にだけ送信できている場合、その組み合わせへは再送しない
    const existingDeliveries = await step.do(
      "list existing deliveries",
      async () =>
        listPushDeliveries(
          pending.map((notification) => notification.id),
          this.env.DB,
        ),
    );
    const delivered = new Set(
      existingDeliveries.map((d) =>
        deliveryKey(d.notificationId, d.subscriptionId),
      ),
    );
    // 404／410、または失敗上限到達で削除された購読。以後はどの通知に対しても再試行しない
    const removedSubscriptionIds = new Set<string>();

    for (const notification of pending) {
      for (const subscription of subscriptions) {
        if (removedSubscriptionIds.has(subscription.id)) {
          continue;
        }
        const key = deliveryKey(notification.id, subscription.id);
        if (delivered.has(key)) {
          continue;
        }

        try {
          const result = await step.do(
            `push ${notification.id} -> ${subscription.id}`,
            {
              retries: {
                limit: 3,
                delay: "30 seconds",
                backoff: "exponential",
              },
            },
            async () => {
              const sendResult = await sendPushToSubscription(
                getDb(this.env.DB),
                subscription,
                notification,
                vapid,
              );
              if (sendResult.outcome === "retriable") {
                // 429／5xx はここで例外にして、このステップのリトライ（上の retries）に
                // 委ねる。揉み消して正常終了すると、リトライが一度も使われないまま
                // 「処理済み」になってしまう
                throw new Error(
                  `Push応答が一時的な失敗でした（status=${sendResult.status}）`,
                );
              }
              return sendResult;
            },
          );
          if (result.outcome === "sent") {
            delivered.add(key);
          } else if (result.outcome === "removed") {
            removedSubscriptionIds.add(subscription.id);
          }
          // "failed"（429／5xx 以外の確定失敗）はここでは未解決のまま残し、
          // 次回のスケジュール実行でこの組み合わせだけ再試行する
        } catch (error) {
          // リトライ上限まで 429／5xx が続いた場合もここに来る。他の購読・通知の処理は続け、
          // この組み合わせは未解決のまま残して次回のスケジュール実行に委ねる
          console.error(
            `Push通知の送信に失敗しました（notification=${notification.id}, subscription=${subscription.id}）`,
            error,
          );
        }
      }
    }

    await step.do("mark notifications as pushed", async () => {
      const db = getDb(this.env.DB);
      const pushedAt = new Date();
      for (const notification of pending) {
        // この実行時点で存在した購読すべてが、送信済みか削除済みになっている場合だけ
        // 送信済みとして確定する。未解決の組み合わせが残る通知は pushedAt を更新せず、
        // 次回のスケジュール実行でその購読だけを対象に再試行する
        const allResolved = subscriptions.every(
          (subscription) =>
            removedSubscriptionIds.has(subscription.id) ||
            delivered.has(deliveryKey(notification.id, subscription.id)),
        );
        if (!allResolved) {
          continue;
        }
        await db
          .update(notifications)
          .set({ pushedAt })
          .where(eq(notifications.id, notification.id));
      }
    });
  }
}
