import type { AuthRequest } from "@cloudflare/workers-oauth-provider";

/**
 * `/authorize` → Cloudflare Access へのリダイレクト → `/callback` の往復の間、
 * `parseAuthRequest()` の結果（`oauthReqInfo`）と PKCE の code_verifier を
 * 一時的に保持するための state トークン発行・検証。
 *
 * 実装は Cloudflare 公式デモ（cloudflare/ai の demos/remote-mcp-cf-access）の
 * workers-oauth-utils.ts を土台にしているが、CANSHI は個人・家庭内利用で
 * MCP クライアントは事実上 1 系統のみのため、クライアント承認ダイアログ・
 * CSRF トークン・承認済みクライアント Cookie は持たない
 */

export interface OAuthStateResult {
  /** state パラメータに使う、署名済みの state トークン（`{uuid}.{hmac}`） */
  stateToken: string;
  /** upstream（Access）への認可リクエストに含める PKCE code_challenge */
  codeChallenge: string;
}

export interface ValidateStateResult {
  oauthReqInfo: AuthRequest;
  codeVerifier: string;
}

const STATE_TTL_SECONDS = 600;

export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
  secret: string,
): Promise<OAuthStateResult> {
  const uuid = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = await generatePKCE();

  // 署名を検証してから KV を引くことで、偽造された state 値による KV への
  // 無駄なアクセスを防ぐ
  const hmac = await signData(uuid, secret);
  const stateToken = `${uuid}.${hmac}`;

  await kv.put(
    `oauth:state:${uuid}`,
    JSON.stringify({ oauthReqInfo, codeVerifier }),
    { expirationTtl: STATE_TTL_SECONDS },
  );

  return { stateToken, codeChallenge };
}

export async function validateOAuthState(
  request: Request,
  kv: KVNamespace,
  secret: string,
): Promise<ValidateStateResult> {
  const url = new URL(request.url);
  const stateFromQuery = url.searchParams.get("state");
  if (!stateFromQuery) {
    throw new Error("state パラメータがありません");
  }

  const dotIndex = stateFromQuery.lastIndexOf(".");
  if (dotIndex === -1) {
    throw new Error("state の形式が不正です");
  }
  const uuid = stateFromQuery.substring(0, dotIndex);
  const hmac = stateFromQuery.substring(dotIndex + 1);

  const isValid = await verifySignature(hmac, uuid, secret);
  if (!isValid) {
    throw new Error("state の署名が不正です");
  }

  const storedDataJson = await kv.get(`oauth:state:${uuid}`);
  if (!storedDataJson) {
    throw new Error("state が無効、または期限切れです");
  }

  // 一度使った state は再利用できないよう削除する
  await kv.delete(`oauth:state:${uuid}`);

  const stored = JSON.parse(storedDataJson) as {
    oauthReqInfo: AuthRequest;
    codeVerifier: string;
  };
  return {
    oauthReqInfo: stored.oauthReqInfo,
    codeVerifier: stored.codeVerifier,
  };
}

/**
 * upstream（Access）の認可エンドポイントへの URL を組み立てる
 */
export function getUpstreamAuthorizeUrl(params: {
  upstream_url: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
}): string {
  const url = new URL(params.upstream_url);
  url.searchParams.set("client_id", params.client_id);
  url.searchParams.set("redirect_uri", params.redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", params.scope);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.code_challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/**
 * upstream（Access）のトークンエンドポイントで認可コードをトークンに交換する
 */
export async function fetchUpstreamAuthToken(params: {
  upstream_url: string;
  client_id: string;
  client_secret: string;
  code?: string;
  redirect_uri: string;
  code_verifier: string;
}): Promise<
  | [idToken: string, errorResponse: null]
  | [idToken: null, errorResponse: Response]
> {
  if (!params.code) {
    return [null, new Response("Missing authorization code", { status: 400 })];
  }

  const body = new URLSearchParams({
    client_id: params.client_id,
    client_secret: params.client_secret,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirect_uri,
    code_verifier: params.code_verifier,
  });

  const response = await fetch(params.upstream_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return [
      null,
      new Response(`Failed to exchange code for token: ${errorText}`, {
        status: response.status,
      }),
    ];
  }

  const json = (await response.json()) as { id_token?: string };
  if (!json.id_token) {
    return [null, new Response("Missing id_token", { status: 400 })];
  }
  return [json.id_token, null];
}

async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(verifierBytes);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function signData(data: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(
  signatureHex: string,
  data: string,
  secret: string,
): Promise<boolean> {
  if (!/^[0-9a-f]+$/i.test(signatureHex)) {
    return false;
  }
  const key = await importHmacKey(secret);
  const signatureBytes = new Uint8Array(
    (signatureHex.match(/.{1,2}/g) ?? []).map((byte) =>
      Number.parseInt(byte, 16),
    ),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(data),
  );
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET が設定されていません");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
