import { getGrantClientId } from "./connections";
import type { McpProps } from "./props";

/**
 * `OAuthProvider` の `apiHandler`（`/mcp`）に渡す前に、リクエストのアクセストークンが
 * どの接続（OAuth のクライアント）のものかを求め、`props.clientId` に入れる。
 * MCP のツールは、これで接続ごとの読み取りの範囲（`./permissions.ts`）を選ぶ。
 *
 * クライアントの ID は同意したときの `props` には入れず、リクエストごとに grant から求める。
 * `props` に入れると、範囲の設定を追加する前に発行されたトークンには無く、トークンを
 * 更新するまで範囲が効かないため。MCP のセッション（Durable Object）は起動したときの
 * `props` を使い続けるが、デプロイで起動し直すため、デプロイの直後から効く。
 * 求められなければ `clientId` を入れず、ツールは読み取りを断る（`./agent.ts`）
 */
export function withMcpClientId(apiHandler: {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response>;
}): { fetch: ExportedHandlerFetchHandler<Env> } {
  return {
    async fetch(request, env, ctx) {
      const props = { ...(ctx.props as McpProps | undefined) };
      delete props.clientId;
      const clientId = props.userId
        ? await resolveClientId(request, props.userId, env.DB)
        : null;
      if (clientId) {
        props.clientId = clientId;
      }
      // `OAuthProvider` も同じく `ctx.props` に代入して `apiHandler` へ渡している
      (ctx as { props: unknown }).props = props;
      return apiHandler.fetch(request, env, ctx);
    },
  };
}

/**
 * アクセストークンの grant のクライアントの ID。`OAuthProvider` は `apiHandler` を呼ぶ前に
 * トークンを検証済みのため、ここではトークンから grant の ID を取り出すだけでよい。
 *
 * アクセストークンは `@cloudflare/workers-oauth-provider`（0.10.4 時点）が
 * `{userId}:{grantId}:{secret}` の形式で発行する。ライブラリを更新したときは、形式が
 * 変わっていないか確かめること（変わると、ツールが読み取りを断るようになる）
 */
export async function resolveClientId(
  request: Request,
  userId: string,
  d1: D1Database,
): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const parts = token?.split(":");
  if (parts?.length !== 3 || parts[0] !== userId) {
    return null;
  }
  return getGrantClientId(userId, parts[1], d1);
}
