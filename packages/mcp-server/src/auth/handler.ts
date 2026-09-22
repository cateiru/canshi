import {
  AuthorizationError,
  type AuthRequest,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { verifyAccessIdToken } from "./access";
import {
  addApprovedClient,
  generateCSRFProtection,
  isClientApproved,
  renderApprovalDialog,
  validateCSRFToken,
} from "./approval";
import { getOidcDiscoveryDocument } from "./discovery";
import {
  createOAuthState,
  fetchUpstreamAuthToken,
  getUpstreamAuthorizeUrl,
  validateOAuthState,
} from "./oauth-state";

/**
 * `OAuthProvider` の `defaultHandler`。`/authorize`（GET・POST）・`/callback` に
 * 加えて、PR33 で追加した `/healthz`（生存確認。認証なしで到達できるため
 * D1 を読み出す値は含まない）もここで扱う。
 *
 * `env.OAUTH_PROVIDER` は `OAuthProvider` が実行時に注入するバインディングで、
 * `wrangler.jsonc` には現れず `Env` の生成型にも含まれないため、ここでのみ
 * 型を補って扱う（Cloudflare 公式デモの `EnvWithOauth` パターンに倣う）
 */
type EnvWithOAuth = Env & { OAUTH_PROVIDER: OAuthHelpers };

export const authHandler: ExportedHandler<Env> = {
  async fetch(request, rawEnv) {
    const env = rawEnv as EnvWithOAuth;
    const url = new URL(request.url);

    if (url.pathname === "/authorize") {
      if (request.method === "GET") return handleAuthorizeGet(request, env);
      if (request.method === "POST") return handleAuthorizePost(request, env);
    }
    if (request.method === "GET" && url.pathname === "/callback") {
      return handleCallback(request, env);
    }
    if (url.pathname === "/healthz") {
      return Response.json({ ok: true });
    }
    // MCP 仕様（RFC 8414 = /.well-known/oauth-authorization-server のみを要求）
    // には無い経路だが、OAuth クライアント実装によっては OIDC discovery
    // （/.well-known/openid-configuration）を汎用的なフォールバックとして
    // 試すことがある。OAuthProvider はこのパスを実装していないため、
    // 念のため同じメタデータをここで折り返す（403 の根本原因ではない可能性が高い。
    // 実際の原因切り分けは Cloudflare エッジ側の bot 対策等を別途確認中）
    if (url.pathname === "/.well-known/openid-configuration") {
      return fetch(new URL("/.well-known/oauth-authorization-server", url), {
        headers: request.headers,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * `parseAuthRequest()` を呼び、`AuthorizationError` は README のパターンに
 * 従って処理する。エラー用の `Response` を返した場合は呼び出し元がそのまま返す
 */
async function parseAuthorizeRequest(
  request: Request,
  env: EnvWithOAuth,
): Promise<AuthRequest | Response> {
  try {
    return await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      throw error;
    }
    if (!error.redirectUri) {
      return new Response(error.description, { status: 400 });
    }
    const redirect = new URL(error.redirectUri);
    redirect.searchParams.set("error", error.code);
    redirect.searchParams.set("error_description", error.description);
    if (error.state) redirect.searchParams.set("state", error.state);
    if (error.issuer) redirect.searchParams.set("iss", error.issuer);
    return Response.redirect(redirect.toString(), 302);
  }
}

async function handleAuthorizeGet(
  request: Request,
  env: EnvWithOAuth,
): Promise<Response> {
  const parsed = await parseAuthorizeRequest(request, env);
  if (parsed instanceof Response) {
    return parsed;
  }
  const oauthReqInfo = parsed;

  if (!oauthReqInfo.clientId) {
    return new Response("Invalid request", { status: 400 });
  }

  // DCR（/register）は誰でも呼べるため、承認画面なしで直接 Access へ
  // リダイレクトすると、攻撃者が登録した任意のクライアントへ認可コードを
  // 渡してしまう危険がある（レビュー指摘）。一度承認したクライアントは
  // Cookie で記憶し、以降は再確認を省略する
  if (
    await isClientApproved(
      request,
      oauthReqInfo.clientId,
      env.OAUTH_STATE_SECRET,
    )
  ) {
    return redirectToAccess(request, env, oauthReqInfo);
  }

  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  const { token: csrfToken, setCookie } = generateCSRFProtection();
  return renderApprovalDialog(request, {
    client,
    csrfToken,
    setCookie,
    state: { oauthReqInfo },
  });
}

async function handleAuthorizePost(
  request: Request,
  env: EnvWithOAuth,
): Promise<Response> {
  const formData = await request.formData();

  let csrfResult: { clearCookie: string };
  try {
    csrfResult = validateCSRFToken(formData, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid CSRF";
    return new Response(message, { status: 400 });
  }

  const encodedState = formData.get("state");
  if (!encodedState || typeof encodedState !== "string") {
    return new Response("Missing state in form data", { status: 400 });
  }
  let state: { oauthReqInfo?: AuthRequest };
  try {
    state = JSON.parse(atob(encodedState));
  } catch {
    return new Response("Invalid state data", { status: 400 });
  }
  if (!state.oauthReqInfo?.clientId) {
    return new Response("Invalid request", { status: 400 });
  }

  const approvedCookie = await addApprovedClient(
    request,
    state.oauthReqInfo.clientId,
    env.OAUTH_STATE_SECRET,
  );
  const extraHeaders = new Headers();
  extraHeaders.append("Set-Cookie", approvedCookie);
  extraHeaders.append("Set-Cookie", csrfResult.clearCookie);

  return redirectToAccess(request, env, state.oauthReqInfo, extraHeaders);
}

async function redirectToAccess(
  request: Request,
  env: EnvWithOAuth,
  oauthReqInfo: AuthRequest,
  extraHeaders: Headers = new Headers(),
): Promise<Response> {
  const { stateToken, codeChallenge } = await createOAuthState(
    oauthReqInfo,
    env.OAUTH_KV,
    env.OAUTH_STATE_SECRET,
  );
  const discovery = await getOidcDiscoveryDocument(env.ACCESS_DISCOVERY_URL);

  const location = getUpstreamAuthorizeUrl({
    upstream_url: discovery.authorization_endpoint,
    client_id: env.ACCESS_CLIENT_ID,
    redirect_uri: new URL("/callback", request.url).href,
    scope: "openid email profile",
    state: stateToken,
    code_challenge: codeChallenge,
  });

  const headers = new Headers(extraHeaders);
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

async function handleCallback(
  request: Request,
  env: EnvWithOAuth,
): Promise<Response> {
  let oauthReqInfo: AuthRequest;
  let codeVerifier: string;
  try {
    ({ oauthReqInfo, codeVerifier } = await validateOAuthState(
      request,
      env.OAUTH_KV,
      env.OAUTH_STATE_SECRET,
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid state";
    return new Response(message, { status: 400 });
  }

  if (!oauthReqInfo.clientId) {
    return new Response("Invalid OAuth request data", { status: 400 });
  }

  const discovery = await getOidcDiscoveryDocument(env.ACCESS_DISCOVERY_URL);
  const code = new URL(request.url).searchParams.get("code") ?? undefined;
  const [idToken, errorResponse] = await fetchUpstreamAuthToken({
    upstream_url: discovery.token_endpoint,
    client_id: env.ACCESS_CLIENT_ID,
    client_secret: env.ACCESS_CLIENT_SECRET,
    code,
    redirect_uri: new URL("/callback", request.url).href,
    code_verifier: codeVerifier,
  });
  if (errorResponse) {
    return errorResponse;
  }

  let identity: Awaited<ReturnType<typeof verifyAccessIdToken>>;
  try {
    identity = await verifyAccessIdToken(idToken, env);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid Access ID token";
    return new Response(message, { status: 403 });
  }

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: identity.sub,
    metadata: { email: identity.email },
    scope: oauthReqInfo.scope,
    props: { email: identity.email, sub: identity.sub },
  });

  return Response.redirect(redirectTo, 302);
}
