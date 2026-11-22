import {
  bindings,
  defineConfig,
  defineWorker,
  exports,
  triggers,
} from "cf/config";

// vinext（`vite.config.ts`）が開発・ビルド・デプロイで読む Worker の設定。
// 以前の `wrangler.toml` の内容をここに移した（Issue #505 の移行の試し）。
// D1 のマイグレーションの適用（`wrangler d1 migrations apply`）は wrangler の設定ファイルを
// 読むため、`wrangler.migrations.toml`・`wrangler.preview-migrations.toml` に D1 だけを残している

/** 本番の D1。`wrangler.migrations.toml` と揃える */
const PRODUCTION_D1 = {
  id: "1f5e487e-f87e-4896-8190-1ae4f4347ca3",
  name: "canshi-db",
};

/** Worker Previews 専用の D1。`wrangler.preview-migrations.toml` と揃える */
const PREVIEW_D1 = {
  id: "b88bd1c2-3cb6-4eac-b812-a5680ca44202",
  name: "canshi-preview-db",
};

export default defineConfig({
  worker: defineWorker(({ isPreview }) => ({
    name: "canshi",
    // OAuth（MCP）の処理・`scheduled`・Workflow を足したカスタムエントリポイント。
    // ページなどは `vinext/server/fetch-handler` に渡す
    entrypoint: "./src/worker.ts",
    compatibilityDate: "2026-09-06",
    // `global_fetch_strictly_public` は MCP の OAuth で CIMD（クライアントの情報を置いた URL）を
    // 取得するのに要る（`@cloudflare/workers-oauth-provider`、`src/worker.ts` 参照）
    compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    // 本番はカスタムドメインだけで公開し、workers.dev は作らない。
    // Worker Previews の URL は `previewUrls` で作る（`docs/deploy.md` の「プレビュー」節）
    domains: ["canshi.app"],
    workersDev: false,
    previewUrls: true,
    // Workers Logs（ダッシュボードでの呼び出しログ・console 出力の閲覧）
    observability: {
      logs: { enabled: true, invocationLogs: true },
    },
    assets: {
      // vinext init が作る既定の設定。`/_next/static/*`（ビルド成果物）以外は Worker を通し、
      // `public/` のファイルにも middleware を通す（`src/middleware.ts`）
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    // 15分ごとに `scheduled` を起動し、NotificationWorkflow のインスタンスを作る。
    // Cron Triggers はプレビューでは動かない
    triggers: isPreview
      ? []
      : [triggers.scheduled({ schedule: "*/15 * * * *" })],
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1(isPreview ? PREVIEW_D1 : PRODUCTION_D1),
      // プレビューは本番の R2・Workflow を共有しないよう、バインドしない（以前の `[previews]` と同じ）
      MEDIA_BUCKET: !isPreview && bindings.r2({ name: "canshi-media" }),
      NOTIFICATION_WORKFLOW:
        !isPreview &&
        bindings.workflow({
          name: "notification-workflow",
          worker: "canshi",
          exportName: "NotificationWorkflow",
        }),
      // Cloudflare Access（OIDC）を通さず、メールアドレスの入力だけでログインできるようにする
      // （`src/features/auth/infrastructure/developmentLogin.ts`）。プレビューの URL は Workers 全体の
      // Access で保護し、D1 は本番と分けているため、プレビューに限って有効にする
      DANGEROUSLY_ENABLE_DEVELOPMENT_LOGIN:
        isPreview && bindings.text<string>("true"),
      // 本番のシークレット（`env.d.ts`・`docs/deploy.md` 参照）。プレビューは本番のシークレットを
      // 引き継がない。宣言していない平文の変数はデプロイのたびに消えるため、すべてシークレットにする
      ACCESS_DISCOVERY_URL: !isPreview && bindings.secret(),
      ACCESS_CLIENT_ID: !isPreview && bindings.secret(),
      ACCESS_CLIENT_SECRET: !isPreview && bindings.secret(),
      EMAIL_HASH_SALT: !isPreview && bindings.secret(),
      VAPID_SUBJECT: !isPreview && bindings.secret(),
      VAPID_PRIVATE_KEY: !isPreview && bindings.secret(),
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: !isPreview && bindings.secret(),
    },
    exports: {
      ...(isPreview
        ? {}
        : {
            NotificationWorkflow: exports.workflow({
              name: "notification-workflow",
            }),
          }),
      // 以前は MCP サーバー本体（`CanshiMcp`）がセッション状態を Durable Object に保持していた。
      // wrangler の migrations（v1 で作成、v2 で削除）で削除済みのクラスを、ここでも削除済みとして残す
      CanshiMcp: exports.durableObject({ state: "deleted" }),
    },
  })),
});
