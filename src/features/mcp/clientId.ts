import { getGrantClientId } from "./connections";
import type { McpProps } from "./props";
import { recordMcpConnectionUsage } from "./usages";

/**
 * `OAuthProvider` の `apiHandler`（`/mcp`）に渡す前に、リクエストのアクセストークンが
 * どの接続（OAuth のクライアント）のものかを求め、`props.clientId` に入れる。
 * MCP のツールは、これで接続ごとの読み取りの範囲（`./permissions.ts`）を選ぶ。
 *
 * クライアントの ID は同意したときの `props` には入れず、リクエストごとに grant から求める。
 * `props` に入れると、範囲の設定を追加する前に発行されたトークンには無く、トークンを
 * 更新するまで範囲が効かないため。MCP のセッション（Durable Object）は起動したときの
 * `props` を使い続けるが、デプロイで起動し直すため、デプロイの直後から効く。
 * 求められなければ `clientId` を入れず、ツールは読み取りを断る（`./agent.ts`）。
 *
 * 求められたときは、設定の「AIとの接続」に表示するため、接続を使った日時も記録する
 * （`./usages.ts`）。記録は応答を待たせないよう `ctx.waitUntil` で行い、失敗しても
 * MCP の応答には影響させない
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
      const connection = props.userId
        ? await resolveConnection(request, props.userId, env.DB)
        : null;
      if (connection && props.userId) {
        props.clientId = connection.clientId;
        ctx.waitUntil(
          recordMcpConnectionUsage(
            props.userId,
            connection.grantId,
            env.DB,
          ).catch((error) => {
            console.error("AI との接続の利用日時の記録に失敗しました", error);
          }),
        );
      }
      // `OAuthProvider` も同じく `ctx.props` に代入して `apiHandler` へ渡している
      (ctx as { props: unknown }).props = props;
      return apiHandler.fetch(request, env, ctx);
    },
  };
}

/**
 * アクセストークンの grant の ID と、そのクライアントの ID。`OAuthProvider` は `apiHandler` を呼ぶ前に
 * トークンを検証済みのため、ここではトークンから grant の ID を取り出すだけでよい。
 *
 * アクセストークンは `@cloudflare/workers-oauth-provider`（0.10.4 時点）が
 * `{userId}:{grantId}:{secret}` の形式で発行する。ライブラリを更新したときは、形式が
 * 変わっていないか確かめること（変わると、ツールが読み取りを断るようになる）
 */
export async function resolveConnection(
  request: Request,
  userId: string,
  d1: D1Database,
): Promise<{ grantId: string; clientId: string } | null> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const parts = token?.split(":");
  if (parts?.length !== 3 || parts[0] !== userId) {
    return null;
  }
  const grantId = parts[1];
  const clientId = await getGrantClientId(userId, grantId, d1);
  return clientId ? { grantId, clientId } : null;
}
