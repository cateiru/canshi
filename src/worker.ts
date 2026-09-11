// `.open-next/worker.js` は `opennextjs-cloudflare build`（`pnpm cf:build` 等）で
// 生成される。ビルド前（`.open-next/` が無いクリーンな環境）は型解決できないため抑制する
// @ts-expect-error
import { default as handler } from "../.open-next/worker.js";

// `wrangler.toml` の `[[workflows]]` の `class_name` はこのモジュール（`main`）からの
// export を指す。Workflow の実体は `src/workflows/notification.ts` にある
export { NotificationWorkflow } from "@/workflows/notification";

export default {
  fetch: handler.fetch,
  async scheduled(controller, env, ctx) {
    // 同じ scheduledTime での重複実行（cron の at-least-once 配信）は
    // 同じ id での2回目の create() が失敗することで自然に防がれる
    ctx.waitUntil(
      env.NOTIFICATION_WORKFLOW.create({
        id: `notification-${controller.scheduledTime}`,
        params: {},
      }).catch((error) => {
        console.error("NotificationWorkflow の起動に失敗しました", error);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
