import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { createCanshiMcpHandler } from "@/features/mcp/agent";
import {
  MCP_API_ROUTE,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_REGISTER_PATH,
  OAUTH_TOKEN_PATH,
  withMcpAuthorize,
} from "@/features/mcp/authorize";
import { withMcpClientId } from "@/features/mcp/clientId";
import {
  D1KvStore,
  purgeExpiredOAuthKvEntries,
} from "@/features/mcp/d1KvStore";
import { purgeOrphanedMcpConnectionUsages } from "@/features/mcp/usages";

// `.open-next/worker.js` は `opennextjs-cloudflare build`（`pnpm cf:build` 等）で
// 生成される。ビルド前（`.open-next/` が無いクリーンな環境）は型解決できないため抑制する
// @ts-expect-error
import { default as handler } from "../.open-next/worker.js";

// `wrangler.toml` の `[[workflows]]` の `class_name` はこのモジュール（`main`）からの
// export を指す。Workflow の実体は `src/workflows/notification.ts` にある
export { NotificationWorkflow } from "@/workflows/notification";

// ChatGPT などの外部 AI エージェント向けの MCP サーバー（`/mcp`）と、その OAuth 2.1
// 認可サーバー。`/mcp`・`/oauth/token`・`/oauth/register`・`/.well-known/oauth-*` は
// Next.js に渡さずここで処理し、それ以外（`/oauth/authorize` の同意画面を含む）は
// Next.js のハンドラに渡す（`docs/plans/32_mcp_oidc_overview.md` 参照）。
//
// トークンは MCP サーバーの URL（`{オリジン}/mcp`、RFC 8707 の resource）に紐づける。
// 本番・`wrangler dev` などで URL が変わるため、オリジンごとに作る
const oauthProviders = new Map<string, OAuthProvider<Env>>();

/** `wrangler dev` などで使う、http のままにするホスト */
const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * トークンを紐づける MCP サーバーの URL のオリジン。ライブラリは localhost 以外では https の
 * resource しか受け付けないため、http で届いたリクエストも https のオリジンに揃える
 */
function resourceOrigin(url: URL) {
  return url.protocol === "http:" && !LOOPBACK_HOSTNAMES.includes(url.hostname)
    ? `https://${url.host}`
    : url.origin;
}

function getOAuthProvider(origin: string) {
  let provider = oauthProviders.get(origin);
  if (!provider) {
    provider = new OAuthProvider<Env>({
      apiRoute: MCP_API_ROUTE,
      // 接続ごとの読み取りの範囲を選べるよう、アクセストークンのクライアントの ID を props に入れる
      apiHandler: withMcpClientId(createCanshiMcpHandler(MCP_API_ROUTE)),
      defaultHandler: withMcpAuthorize(handler),
      authorizeEndpoint: OAUTH_AUTHORIZE_PATH,
      tokenEndpoint: OAUTH_TOKEN_PATH,
      resourceMetadata: {
        resource: `${origin}${MCP_API_ROUTE}`,
        resource_name: "CANSHI",
      },
      // クライアントの登録は、MCP の 2026-07-28 版で推奨される Client ID Metadata Document
      // （CIMD、クライアントの情報を置いた URL を client_id にする方式）を受け付ける。
      // CIMD に対応していないクライアントのため、Dynamic Client Registration（DCR）も残す。
      // CIMD の文書の取得には `wrangler.toml` の `global_fetch_strictly_public` が要る
      clientIdMetadataDocumentEnabled: true,
      clientRegistrationEndpoint: OAUTH_REGISTER_PATH,
    });
    oauthProviders.set(origin, provider);
  }
  return provider;
}

export default {
  fetch(request, env, ctx) {
    // OAuth のクライアント登録・認可・トークンは Workers KV ではなく D1 に保存する。
    // ライブラリは `env.OAUTH_KV` を直接読み書きするため、D1 で実装した KV を渡す
    const envWithOAuthKv: Env & { OAUTH_KV: KVNamespace } = {
      ...env,
      OAUTH_KV: new D1KvStore(env.DB) as unknown as KVNamespace,
    };
    return getOAuthProvider(resourceOrigin(new URL(request.url))).fetch(
      request,
      envWithOAuthKv,
      ctx,
    );
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      purgeExpiredOAuthKvEntries(env.DB)
        .catch((error) => {
          console.error("期限切れの OAuth のデータの削除に失敗しました", error);
        })
        // 期限切れの grant を消した後に、grant が無くなった接続の記録を消す
        .then(() => purgeOrphanedMcpConnectionUsages(env.DB))
        .catch((error) => {
          console.error(
            "AI との接続の利用日時の古い記録の削除に失敗しました",
            error,
          );
        }),
    );
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
