// @vitest-environment node
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCodeChallenge,
  OIDC_STATE_COOKIE_NAME,
} from "@/features/auth/oidc";
import { SESSION_COOKIE_NAME } from "@/features/auth/sessionToken";
import { GET as start } from "../start/route";
import { GET as callback } from "./route";

const ORIGIN = "https://canshi.example.com";
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const CLIENT_ID = "access-client-id";
const ISSUER = `https://team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/${CLIENT_ID}`;
const env = {
  ACCESS_DISCOVERY_URL: `${ISSUER}/.well-known/openid-configuration`,
  ACCESS_CLIENT_ID: CLIENT_ID,
  ACCESS_CLIENT_SECRET: "client-secret",
};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env }),
}));

const loginWithEmail = vi.fn();
vi.mock("@/features/auth/login", () => ({
  loginWithEmail: (...args: unknown[]) => loginWithEmail(...args),
}));

let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;
/** トークンエンドポイントが返す ID トークンの中身（テストごとに変える） */
let idTokenClaims: Record<string, unknown>;
let tokenRequests: URLSearchParams[];

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  publicJwk = { ...(await exportJWK(keyPair.publicKey)), kid: "k1" };
});

beforeEach(() => {
  loginWithEmail.mockReset();
  loginWithEmail.mockResolvedValue({
    token: "session-token",
    expiresAt: new Date(Date.now() + 60_000),
  });
  tokenRequests = [];
  vi.spyOn(console, "error").mockImplementation(() => {});

  // Access の discovery・トークン・JWKS の各エンドポイント
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === env.ACCESS_DISCOVERY_URL) {
        return Response.json({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/authorization`,
          token_endpoint: `${ISSUER}/token`,
          jwks_uri: `${ISSUER}/jwks`,
        });
      }
      if (url === `${ISSUER}/token`) {
        tokenRequests.push(new URLSearchParams(String(init?.body)));
        const idToken = await new SignJWT(idTokenClaims)
          .setProtectedHeader({ alg: "RS256", kid: "k1" })
          .setIssuer(ISSUER)
          .setAudience(CLIENT_ID)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey);
        return Response.json({ id_token: idToken });
      }
      if (url === `${ISSUER}/jwks`) {
        return Response.json({ keys: [publicJwk] });
      }
      return new Response("not found", { status: 404 });
    }),
  );
});

/** `/login/start` を開き、Access へのリダイレクト先と state の Cookie を返す */
async function startLogin(callbackUrl: string) {
  const response = await start(
    new NextRequest(
      `${ORIGIN}/login/start?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    ),
  );
  expect(response.status).toBe(307);
  const authorizationUrl = new URL(response.headers.get("location") ?? "");
  const stateCookie = response.cookies.get(OIDC_STATE_COOKIE_NAME);
  return { authorizationUrl, stateCookie };
}

function callbackRequest(query: Record<string, string>, cookie?: string) {
  return new NextRequest(
    `${ORIGIN}/login/callback?${new URLSearchParams(query)}`,
    {
      headers: {
        "user-agent": USER_AGENT,
        ...(cookie ? { cookie: `${OIDC_STATE_COOKIE_NAME}=${cookie}` } : {}),
      },
    },
  );
}

describe("/login/start → /login/callback", () => {
  it("Access でログインすると、メールアドレスでログインして元のページへ戻る", async () => {
    const { authorizationUrl, stateCookie } = await startLogin("/cats?x=1");

    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe(
      `${ISSUER}/authorization`,
    );
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid email");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      `${ORIGIN}/login/callback`,
    );
    expect(stateCookie?.httpOnly).toBe(true);
    expect(stateCookie?.sameSite).toBe("lax");
    expect(stateCookie?.path).toBe("/login/callback");

    idTokenClaims = {
      email: "Owner@Example.com",
      nonce: authorizationUrl.searchParams.get("nonce"),
    };
    const response = await callback(
      callbackRequest(
        {
          code: "auth-code",
          state: authorizationUrl.searchParams.get("state") ?? "",
        },
        stateCookie?.value,
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/cats?x=1`);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe(
      "session-token",
    );
    expect(response.cookies.get(OIDC_STATE_COOKIE_NAME)?.value).toBe("");
    // ログインしたブラウザの User-Agent をセッションに保存する（端末一覧の表示用）
    expect(loginWithEmail).toHaveBeenCalledWith(
      "Owner@Example.com",
      env,
      USER_AGENT,
    );

    // 認可コードは PKCE の code_verifier・client secret と一緒に交換する
    const [tokenRequest] = tokenRequests;
    expect(tokenRequest.get("code")).toBe("auth-code");
    expect(tokenRequest.get("client_secret")).toBe("client-secret");
    expect(
      await createCodeChallenge(tokenRequest.get("code_verifier") ?? ""),
    ).toBe(authorizationUrl.searchParams.get("code_challenge"));
  });

  it("state が一致しなければログインせず、エラーを表示する", async () => {
    const { stateCookie } = await startLogin("/cats");

    const response = await callback(
      callbackRequest(
        { code: "auth-code", state: "forged" },
        stateCookie?.value,
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/login?error=1&callbackUrl=%2Fcats`,
    );
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(loginWithEmail).not.toHaveBeenCalled();
    expect(tokenRequests).toHaveLength(0);
  });

  it("state の Cookie がなければログインしない", async () => {
    const response = await callback(
      callbackRequest({ code: "auth-code", state: "state" }),
    );

    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=1`);
    expect(loginWithEmail).not.toHaveBeenCalled();
  });

  it("Access がエラーを返したらログインしない", async () => {
    const { authorizationUrl, stateCookie } = await startLogin("/");

    const response = await callback(
      callbackRequest(
        {
          error: "access_denied",
          state: authorizationUrl.searchParams.get("state") ?? "",
        },
        stateCookie?.value,
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/login?error=1&callbackUrl=%2F`,
    );
    expect(loginWithEmail).not.toHaveBeenCalled();
  });

  it("ID トークンの nonce が一致しなければログインしない", async () => {
    const { authorizationUrl, stateCookie } = await startLogin("/");

    idTokenClaims = { email: "owner@example.com", nonce: "other-nonce" };
    const response = await callback(
      callbackRequest(
        {
          code: "auth-code",
          state: authorizationUrl.searchParams.get("state") ?? "",
        },
        stateCookie?.value,
      ),
    );

    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/login?error=1&callbackUrl=%2F`,
    );
    expect(loginWithEmail).not.toHaveBeenCalled();
  });
});
