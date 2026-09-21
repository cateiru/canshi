import {
  AuthorizationError,
  type AuthRequest,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { verifyAccessIdToken } from "./access";
import {
  createOAuthState,
  fetchUpstreamAuthToken,
  getUpstreamAuthorizeUrl,
  validateOAuthState,
} from "./oauth-state";

/**
 * `OAuthProvider` の `defaultHandler`。`/authorize`・`/callback` に加えて、
 * PR33 で追加した `/healthz`（Service Bindings の疎通確認）もここで扱う。
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

    if (request.method === "GET" && url.pathname === "/authorize") {
      return handleAuthorize(request, env);
    }
    if (request.method === "GET" && url.pathname === "/callback") {
      return handleCallback(request, env);
    }
    if (url.pathname === "/healthz") {
      const cats = await env.MAIN_APP.listCats();
      return Response.json({ ok: true, catCount: cats.length });
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleAuthorize(
  request: Request,
  env: EnvWithOAuth,
): Promise<Response> {
  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
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

  if (!oauthReqInfo.clientId) {
    return new Response("Invalid request", { status: 400 });
  }

  // CANSHI は個人・家庭内利用のため、クライアント承認ダイアログは設けず
  // 直接 Cloudflare Access のログインへリダイレクトする
  const { stateToken, codeChallenge } = await createOAuthState(
    oauthReqInfo,
    env.OAUTH_KV,
    env.OAUTH_STATE_SECRET,
  );

  const location = getUpstreamAuthorizeUrl({
    upstream_url: env.ACCESS_AUTHORIZATION_URL,
    client_id: env.ACCESS_CLIENT_ID,
    redirect_uri: new URL("/callback", request.url).href,
    scope: "openid email profile",
    state: stateToken,
    code_challenge: codeChallenge,
  });
  return Response.redirect(location, 302);
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

  const code = new URL(request.url).searchParams.get("code") ?? undefined;
  const [idToken, errorResponse] = await fetchUpstreamAuthToken({
    upstream_url: env.ACCESS_TOKEN_URL,
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
