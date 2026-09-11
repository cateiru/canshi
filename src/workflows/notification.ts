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
  listPushSubscriptions,
  listUnpushedNotifications,
} from "@/features/push/queries";
import { sendPushToSubscription } from "@/features/push/sendPush";
import { getVapidKeys } from "@/features/push/vapid";

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

    for (const notification of pending) {
      for (const subscription of subscriptions) {
        try {
          await step.do(
            `push ${notification.id} -> ${subscription.id}`,
            {
              retries: {
                limit: 3,
                delay: "30 seconds",
                backoff: "exponential",
              },
            },
            async () => {
              await sendPushToSubscription(
                getDb(this.env.DB),
                subscription,
                notification,
                vapid,
              );
            },
          );
        } catch (error) {
          // 1つの購読への送信がリトライ上限まで失敗しても、他の購読・通知の処理は続ける
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
        await db
          .update(notifications)
          .set({ pushedAt })
          .where(eq(notifications.id, notification.id));
      }
    });
  }
}
