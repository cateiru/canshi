import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import { sanitizeCallbackUrl } from "./callbackUrl";

/**
 * Cloudflare Access の SaaS OIDC アプリでログインするための処理（認可コードフロー + PKCE）。
 * issuer・各エンドポイント・JWKS は discovery ドキュメントから導出する。Access for SaaS のこれらの値は Team domain
 * 全体で共通ではなく、アプリ（Client ID）ごとに異なる
 */

/** OIDC で要求するスコープ。個人情報をできるだけ持たないため、メールアドレスだけにする */
export const OIDC_SCOPE = "openid email";

/** `/login/start` から `/login/callback` までの間、state・PKCE の値を保存する Cookie */
export const OIDC_STATE_COOKIE_NAME = "canshi-oidc-state";

/** state の Cookie の有効期間。Access でのログインに時間がかかっても間に合うようにする */
export const OIDC_STATE_MAX_AGE_SECONDS = 10 * 60;

/** Access からの戻り先。`/login` 配下にして、middleware のログイン確認の対象外にする */
export const OIDC_CALLBACK_PATH = "/login/callback";

export type OidcConfig = {
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
};

type OidcEnv = Pick<
  CloudflareEnv,
  "ACCESS_DISCOVERY_URL" | "ACCESS_CLIENT_ID" | "ACCESS_CLIENT_SECRET"
>;

/** OIDC の設定。どれか 1 つでも未設定なら null */
export function getOidcConfig(env: OidcEnv): OidcConfig | null {
  const {
    ACCESS_DISCOVERY_URL: discoveryUrl,
    ACCESS_CLIENT_ID: clientId,
    ACCESS_CLIENT_SECRET: clientSecret,
  } = env;
  if (!discoveryUrl || !clientId || !clientSecret) {
    return null;
  }
  return { discoveryUrl, clientId, clientSecret };
}

/** OIDC の設定を返す。未設定ならエラーにする（設定漏れのままログインできる状態にしない） */
export function requireOidcConfig(env: OidcEnv): OidcConfig {
  const config = getOidcConfig(env);
  if (!config) {
    throw new Error(
      "ログインの設定（ACCESS_DISCOVERY_URL・ACCESS_CLIENT_ID・ACCESS_CLIENT_SECRET）がありません",
    );
  }
  return config;
}

export type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

const REQUIRED_DISCOVERY_FIELDS = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
] as const;

// Worker のアイソレートが再利用される間は、同じ discovery URL への fetch を一度だけにする。
// SaaS OIDC アプリのエンドポイントは作成後に変わらないため、TTL は設けない
const discoveryCache = new Map<string, Promise<OidcDiscoveryDocument>>();

/** OIDC discovery ドキュメント（`.../.well-known/openid-configuration`）を取得する */
export function getOidcDiscoveryDocument(
  discoveryUrl: string,
): Promise<OidcDiscoveryDocument> {
  let cached = discoveryCache.get(discoveryUrl);
  if (!cached) {
    cached = fetchOidcDiscoveryDocument(discoveryUrl).catch((error) => {
      discoveryCache.delete(discoveryUrl);
      throw error;
    });
    discoveryCache.set(discoveryUrl, cached);
  }
  return cached;
}

async function fetchOidcDiscoveryDocument(
  discoveryUrl: string,
): Promise<OidcDiscoveryDocument> {
  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(
      `OIDC discovery document の取得に失敗しました (${response.status})`,
    );
  }
  const body = (await response.json()) as Record<string, unknown>;
  for (const field of REQUIRED_DISCOVERY_FIELDS) {
    if (typeof body[field] !== "string") {
      throw new Error(`OIDC discovery document に ${field} がありません`);
    }
  }
  return body as unknown as OidcDiscoveryDocument;
}

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(jwksUri: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

/** `/login/start` から `/login/callback` まで Cookie に保存する値 */
export type OidcLoginState = {
  state: string;
  nonce: string;
  codeVerifier: string;
  /** ログイン後に戻るアプリ内のパス（`sanitizeCallbackUrl` 済み） */
  callbackUrl: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function randomBase64Url(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

/** PKCE の code_verifier から code_challenge（S256）を作る */
export async function createCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

/** ログインを始めるときに、state・nonce・PKCE の code_verifier を作る */
export function createOidcLoginState(callbackUrl: string): OidcLoginState {
  return {
    state: randomBase64Url(),
    nonce: randomBase64Url(),
    codeVerifier: randomBase64Url(),
    callbackUrl: sanitizeCallbackUrl(callbackUrl),
  };
}

export function encodeOidcLoginState(loginState: OidcLoginState): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(loginState)));
}

/** Cookie の値を読み取る。形式が正しくなければ null */
export function decodeOidcLoginState(
  value: string | undefined,
): OidcLoginState | null {
  if (!value) {
    return null;
  }
  try {
    const json = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(json, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("state" in parsed && typeof parsed.state === "string") ||
      !("nonce" in parsed && typeof parsed.nonce === "string") ||
      !("codeVerifier" in parsed && typeof parsed.codeVerifier === "string") ||
      !("callbackUrl" in parsed && typeof parsed.callbackUrl === "string")
    ) {
      return null;
    }
    return {
      state: parsed.state,
      nonce: parsed.nonce,
      codeVerifier: parsed.codeVerifier,
      // Cookie の値は改ざんされうるため、戻り先は読み出すときにも検証し直す
      callbackUrl: sanitizeCallbackUrl(parsed.callbackUrl),
    };
  } catch {
    return null;
  }
}

/** Access の認可エンドポイントへの URL を組み立てる */
export async function buildAuthorizationUrl(params: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  loginState: OidcLoginState;
}) {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OIDC_SCOPE);
  url.searchParams.set("state", params.loginState.state);
  url.searchParams.set("nonce", params.loginState.nonce);
  url.searchParams.set(
    "code_challenge",
    await createCodeChallenge(params.loginState.codeVerifier),
  );
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

/** トークンエンドポイントで認可コードを ID トークンに交換する */
export async function exchangeAuthorizationCode(params: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<string> {
  const response = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `認可コードをトークンに交換できませんでした (${response.status})`,
    );
  }
  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") {
    throw new Error("トークンのレスポンスに id_token がありません");
  }
  return body.id_token;
}

/**
 * ID トークンの署名・issuer・audience・有効期限・nonce を検証し、メールアドレスを返す。
 *
 * @param jwks テストでは鍵を直接渡す。省略時は discovery の `jwks_uri` から取得する
 */
export async function verifyIdToken(
  idToken: string,
  params: {
    issuer: string;
    jwksUri: string;
    clientId: string;
    nonce: string;
    jwks?: JWTVerifyGetKey;
  },
): Promise<{ email: string }> {
  const { payload } = await jwtVerify(
    idToken,
    params.jwks ?? getRemoteJwks(params.jwksUri),
    { issuer: params.issuer, audience: params.clientId },
  );
  if (payload.nonce !== params.nonce) {
    throw new Error("ID トークンの nonce が一致しません");
  }
  if (typeof payload.email !== "string" || !payload.email) {
    throw new Error("ID トークンに email クレームがありません");
  }
  return { email: payload.email };
}
