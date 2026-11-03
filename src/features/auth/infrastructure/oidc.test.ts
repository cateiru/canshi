// @vitest-environment node
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildAuthorizationUrl,
  createCodeChallenge,
  createOidcLoginState,
  decodeOidcLoginState,
  encodeOidcLoginState,
  getOidcConfig,
  requireOidcConfig,
  verifyIdToken,
} from "./oidc";

const CLIENT_ID = "access-client-id";
const ISSUER = `https://canshi-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/${CLIENT_ID}`;
const KID = "test-key-1";

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keyPair.publicKey)), kid: KID, alg: "RS256" }],
  });
});

function signIdToken(
  claims: Record<string, unknown>,
  options?: { audience?: string; issuer?: string; expiresIn?: string },
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuedAt()
    .setIssuer(options?.issuer ?? ISSUER)
    .setAudience(options?.audience ?? CLIENT_ID)
    .setExpirationTime(options?.expiresIn ?? "5m")
    .sign(privateKey);
}

const verifyParams = (nonce: string) => ({
  issuer: ISSUER,
  jwksUri: "https://example.invalid/jwks",
  clientId: CLIENT_ID,
  nonce,
  jwks,
});

describe("verifyIdToken", () => {
  it("署名・issuer・audience・nonce が正しければメールアドレスを返す", async () => {
    const token = await signIdToken({
      email: "owner@example.com",
      nonce: "nonce-1",
    });

    await expect(
      verifyIdToken(token, verifyParams("nonce-1")),
    ).resolves.toEqual({ email: "owner@example.com" });
  });

  it("nonce が一致しなければ拒否する", async () => {
    const token = await signIdToken({
      email: "owner@example.com",
      nonce: "nonce-other",
    });

    await expect(verifyIdToken(token, verifyParams("nonce-1"))).rejects.toThrow(
      "nonce",
    );
  });

  it("email クレームがなければ拒否する", async () => {
    const token = await signIdToken({ nonce: "nonce-1" });

    await expect(verifyIdToken(token, verifyParams("nonce-1"))).rejects.toThrow(
      "email",
    );
  });

  it("別のアプリ（audience）や issuer 向けのトークンは拒否する", async () => {
    const otherAudience = await signIdToken(
      { email: "owner@example.com", nonce: "nonce-1" },
      { audience: "other-client" },
    );
    const otherIssuer = await signIdToken(
      { email: "owner@example.com", nonce: "nonce-1" },
      { issuer: "https://evil.example.com" },
    );

    await expect(
      verifyIdToken(otherAudience, verifyParams("nonce-1")),
    ).rejects.toThrow();
    await expect(
      verifyIdToken(otherIssuer, verifyParams("nonce-1")),
    ).rejects.toThrow();
  });

  it("期限切れのトークンは拒否する", async () => {
    const token = await signIdToken(
      { email: "owner@example.com", nonce: "nonce-1" },
      { expiresIn: "-1m" },
    );

    await expect(
      verifyIdToken(token, verifyParams("nonce-1")),
    ).rejects.toThrow();
  });

  it("別の鍵で署名されたトークンは拒否する", async () => {
    const { privateKey: otherKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({
      email: "owner@example.com",
      nonce: "nonce-1",
    })
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime("5m")
      .sign(otherKey);

    await expect(
      verifyIdToken(token, verifyParams("nonce-1")),
    ).rejects.toThrow();
  });
});

describe("OIDC のログイン状態（Cookie）", () => {
  it("エンコードした値を読み戻せる", () => {
    const loginState = createOidcLoginState("/cats?tab=1");

    expect(decodeOidcLoginState(encodeOidcLoginState(loginState))).toEqual(
      loginState,
    );
  });

  it("ログインのたびに異なる state・nonce・code_verifier を作る", () => {
    const a = createOidcLoginState("/");
    const b = createOidcLoginState("/");

    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });

  it("戻り先は外部のサイトにしない（Cookie を書き換えられても読み出し時に検証する）", () => {
    expect(createOidcLoginState("https://evil.example.com").callbackUrl).toBe(
      "/",
    );

    const tampered = encodeOidcLoginState({
      ...createOidcLoginState("/"),
      callbackUrl: "//evil.example.com",
    });
    expect(decodeOidcLoginState(tampered)?.callbackUrl).toBe("/");
  });

  it("形式が正しくない値は null にする", () => {
    expect(decodeOidcLoginState(undefined)).toBeNull();
    expect(decodeOidcLoginState("not-base64!")).toBeNull();
    expect(
      decodeOidcLoginState(
        Buffer.from(JSON.stringify({ state: "s" })).toString("base64url"),
      ),
    ).toBeNull();
  });
});

describe("buildAuthorizationUrl", () => {
  it("スコープはメールアドレスだけにし、state・nonce・PKCE を付ける", async () => {
    const loginState = createOidcLoginState("/");
    const url = await buildAuthorizationUrl({
      authorizationEndpoint: `${ISSUER}/authorization`,
      clientId: CLIENT_ID,
      redirectUri: "https://canshi.example.com/login/callback",
      loginState,
    });

    expect(url.origin + url.pathname).toBe(`${ISSUER}/authorization`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT_ID,
      redirect_uri: "https://canshi.example.com/login/callback",
      response_type: "code",
      scope: "openid email",
      state: loginState.state,
      nonce: loginState.nonce,
      code_challenge: await createCodeChallenge(loginState.codeVerifier),
      code_challenge_method: "S256",
    });
  });
});

describe("createCodeChallenge", () => {
  it("RFC 7636 の例と同じ値になる", async () => {
    await expect(
      createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("getOidcConfig / requireOidcConfig", () => {
  const env = {
    ACCESS_DISCOVERY_URL: `${ISSUER}/.well-known/openid-configuration`,
    ACCESS_CLIENT_ID: CLIENT_ID,
    ACCESS_CLIENT_SECRET: "secret",
  };

  it("すべて設定されていれば設定を返す", () => {
    expect(getOidcConfig(env)).toEqual({
      discoveryUrl: env.ACCESS_DISCOVERY_URL,
      clientId: CLIENT_ID,
      clientSecret: "secret",
    });
  });

  it("どれかが未設定なら null にし、require ではエラーにする", () => {
    const missing = { ...env, ACCESS_CLIENT_SECRET: undefined };

    expect(getOidcConfig(missing)).toBeNull();
    expect(() => requireOidcConfig(missing)).toThrow(
      "ログインの設定（ACCESS_DISCOVERY_URL・ACCESS_CLIENT_ID・ACCESS_CLIENT_SECRET）がありません",
    );
  });
});
