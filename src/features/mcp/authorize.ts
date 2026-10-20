import {
  AuthorizationError,
  type AuthRequest,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { getSessionUser } from "@/features/auth/sessions";
import { SESSION_COOKIE_NAME } from "@/features/auth/sessionToken";
import { encodeMcpConsentRequest, MCP_CONSENT_HEADER } from "./consent";
import { MCP_PERMISSIONS_FIELD_NAME } from "./permissionRules";
import { saveMcpPermissionsFromForm } from "./permissions";
import type { McpProps } from "./props";

/** MCP サーバー本体（Streamable HTTP）のパス。OAuth のアクセストークンで保護する */
export const MCP_API_ROUTE = "/mcp";

/**
 * OAuth 2.1 認可サーバーのエンドポイント。`/oauth/token`・`/oauth/register` は
 * `OAuthProvider` が、`/oauth/authorize` は `handleMcpAuthorize` が処理する
 */
export const OAUTH_AUTHORIZE_PATH = "/oauth/authorize";
export const OAUTH_TOKEN_PATH = "/oauth/token";
export const OAUTH_REGISTER_PATH = "/oauth/register";

/**
 * `env.OAUTH_PROVIDER` は `OAuthProvider` が `defaultHandler` を呼ぶ前に注入する値で、
 * `wrangler.toml` には現れず `Env` の生成型にも含まれないため、ここでのみ型を補う
 */
type EnvWithOAuth = Env & { OAUTH_PROVIDER: OAuthHelpers };

/**
 * `OAuthProvider` の `defaultHandler`（MCP・OAuth のエンドポイント以外のリクエスト）を、
 * `/oauth/authorize` の処理を足して Next.js のハンドラへ渡すようにする。
 *
 * - `GET /oauth/authorize`: 認可リクエストを検証し、同意画面（Next.js のページ）を表示する。
 *   未ログインなら、ページの middleware がログイン画面へリダイレクトする
 * - `POST /oauth/authorize`: 同意画面のボタンの送信先。ログイン中のユーザーで、同意画面で
 *   選んだ読み取り・書き込みを許可する範囲を保存してから認可を完了する
 */
export function withMcpAuthorize(nextHandler: {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response>;
}): ExportedHandler<Env> {
  return {
    async fetch(rawRequest, rawEnv, ctx) {
      const env = rawEnv as EnvWithOAuth;
      const request = withoutConsentHeader(rawRequest);
      const url = new URL(request.url);
      const next = (nextRequest: Request) =>
        nextHandler.fetch(nextRequest, env, ctx);

      if (url.pathname === OAUTH_AUTHORIZE_PATH) {
        if (request.method === "GET") {
          return handleAuthorizeGet(request, env.OAUTH_PROVIDER, next);
        }
        if (request.method === "POST") {
          return handleAuthorizePost(request, env, env.OAUTH_PROVIDER);
        }
      }
      if (url.pathname === "/.well-known/openid-configuration") {
        return openIdConfiguration(url);
      }
      // OAuth クライアントは `/.well-known/oauth-authorization-server/mcp` のように
      // 複数の場所を順に試して設定を探す（ChatGPT もこのパスを要求する）。Next.js に渡すと
      // ログイン画面（HTML）へリダイレクトされ、クライアントは設定が壊れているとみなして
      // 次の場所を試さずに失敗するため、`OAuthProvider` が処理しない `/.well-known/` 配下は
      // 404 にして、次の場所を試してもらう
      if (url.pathname.startsWith("/.well-known/")) {
        return new Response("Not Found", { status: 404 });
      }
      return next(request);
    },
  };
}

/** 外部から付けられた同意画面用のヘッダーを取り除く（`consent.ts` 参照） */
function withoutConsentHeader(request: Request) {
  if (!request.headers.has(MCP_CONSENT_HEADER)) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.delete(MCP_CONSENT_HEADER);
  return new Request(request, { headers });
}

/**
 * `parseAuthRequest()` を呼び、`AuthorizationError` は `workers-oauth-provider` の
 * README のパターンに従って処理する。エラー用の `Response` を返した場合は
 * 呼び出し元がそのまま返す
 */
async function parseAuthorizeRequest(
  request: Request,
  helpers: OAuthHelpers,
): Promise<AuthRequest | Response> {
  try {
    return await helpers.parseAuthRequest(request);
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
  helpers: OAuthHelpers,
  next: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  const authRequest = await parseAuthorizeRequest(request, helpers);
  if (authRequest instanceof Response) {
    return authRequest;
  }
  const client = await helpers.lookupClient(authRequest.clientId);

  const headers = new Headers(request.headers);
  headers.set(
    MCP_CONSENT_HEADER,
    encodeMcpConsentRequest({
      clientId: authRequest.clientId,
      clientName: client?.clientName ?? null,
      redirectUri: authRequest.redirectUri,
    }),
  );
  const response = await next(new Request(request, { headers }));

  // 同意ボタンを別サイトに埋め込んで押させる（クリックジャッキング）のを防ぐ
  const framed = new Response(response.body, response);
  framed.headers.set("X-Frame-Options", "DENY");
  framed.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  return framed;
}

async function handleAuthorizePost(
  request: Request,
  env: Env,
  helpers: OAuthHelpers,
): Promise<Response> {
  const url = new URL(request.url);

  // 別サイトのフォームから送らせて同意させる（CSRF）のを防ぐ。セッションの Cookie も
  // SameSite=Lax のため別サイトからの POST には付かないが、念のため Origin も確かめる
  if (request.headers.get("Origin") !== url.origin) {
    return new Response("Forbidden", { status: 403 });
  }

  const token = getCookie(request, SESSION_COOKIE_NAME);
  const user = token ? await getSessionUser(token, env.DB) : null;
  if (!user) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("callbackUrl", `${url.pathname}${url.search}`);
    return Response.redirect(login.toString(), 303);
  }

  // フォームには認可リクエストの内容を載せず、同意画面の URL のクエリ（GET と同じもの）を
  // もう一度検証する。フォームの値を信用すると、認可コードを渡す先を書き換えられてしまう
  const authRequest = await parseAuthorizeRequest(request, helpers);
  if (authRequest instanceof Response) {
    return authRequest;
  }

  const formData = await request.formData();
  if (formData.get("decision") !== "approve") {
    return Response.redirect(accessDeniedUrl(authRequest), 303);
  }

  // 読み取り・書き込みを許可する範囲はトークンには持たせず、接続（クライアント）ごとに保存して、
  // ツールが呼ばれるたびに読む（`./permissions.ts`）。範囲の項目が無いフォーム
  // （範囲の選択を追加する前に開いた同意画面）からの送信では、今の範囲のままにする
  if (
    formData.has(MCP_PERMISSIONS_FIELD_NAME) &&
    !(await saveMcpPermissionsFromForm(
      user.id,
      authRequest.clientId,
      formData,
      env.DB,
    ))
  ) {
    return new Response(
      "許可する範囲が正しくありません。接続するアプリから、もう一度やり直してください。",
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const props: McpProps = { userId: user.id };
  const { redirectTo } = await helpers.completeAuthorization({
    request: authRequest,
    userId: user.id,
    metadata: {},
    scope: authRequest.scope,
    props,
  });
  return Response.redirect(redirectTo, 303);
}

/** 同意画面で「許可しない」を押したときの戻り先（RFC 6749 の `access_denied`） */
function accessDeniedUrl(authRequest: AuthRequest) {
  const redirect = new URL(authRequest.redirectUri);
  redirect.searchParams.set("error", "access_denied");
  if (authRequest.state) redirect.searchParams.set("state", authRequest.state);
  if (authRequest.issuer) redirect.searchParams.set("iss", authRequest.issuer);
  return redirect.toString();
}

function getCookie(request: Request, name: string) {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index !== -1 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return null;
}

/**
 * MCP 仕様（RFC 8414 = `/.well-known/oauth-authorization-server` のみを要求）には
 * 無い経路だが、OAuth クライアント実装によっては OIDC discovery を汎用的な
 * フォールバックとして試すことがあるため、`OAuthProvider` の設定と同じ
 * エンドポイントをここでも返す。Next.js に渡すとログイン画面へリダイレクトされてしまう
 */
function openIdConfiguration(url: URL) {
  return Response.json({
    issuer: url.origin,
    authorization_endpoint: `${url.origin}${OAUTH_AUTHORIZE_PATH}`,
    token_endpoint: `${url.origin}${OAUTH_TOKEN_PATH}`,
    registration_endpoint: `${url.origin}${OAUTH_REGISTER_PATH}`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    revocation_endpoint: `${url.origin}${OAUTH_TOKEN_PATH}`,
    code_challenge_methods_supported: ["S256"],
  });
}
