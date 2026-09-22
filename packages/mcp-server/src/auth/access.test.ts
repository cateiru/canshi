import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyAccessIdToken } from "./access";

const CLIENT_ID = "access-client-id";
// Access for SaaS の issuer・JWKS はアプリ（client_id）ごとに異なる
// （Team domain 共通の /cdn-cgi/access/certs ではない）
const ISSUER = `https://canshi-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/${CLIENT_ID}`;
const KID = "test-key-1";

let privateKey: CryptoKey;
let localJwks: JWTVerifyGetKey;

const testEnv = {
  // discovery の fetch は overrides で回避するため、実際には参照されない
  ACCESS_DISCOVERY_URL:
    "https://example.invalid/.well-known/openid-configuration",
  ACCESS_CLIENT_ID: CLIENT_ID,
};

async function signIdToken(
  claims: Record<string, unknown>,
  options?: { expiresIn?: string; audience?: string; issuer?: string },
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuedAt()
    .setIssuer(options?.issuer ?? ISSUER)
    .setAudience(options?.audience ?? CLIENT_ID)
    .setExpirationTime(options?.expiresIn ?? "5m")
    .sign(privateKey);
}

beforeAll(async () => {
  const { publicKey, privateKey: generatedPrivateKey } =
    await generateKeyPair("RS256");
  privateKey = generatedPrivateKey;
  const publicJwk = await exportJWK(publicKey);
  localJwks = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: KID, alg: "RS256" }],
  });
});

describe("verifyAccessIdToken", () => {
  it("extracts email and sub from a validly signed ID token", async () => {
    const token = await signIdToken({
      email: "owner@example.com",
      sub: "user-123",
    });

    const identity = await verifyAccessIdToken(token, testEnv, {
      jwks: localJwks,
      issuer: ISSUER,
    });

    expect(identity).toEqual({ email: "owner@example.com", sub: "user-123" });
  });

  it("rejects a token issued for a different audience", async () => {
    const token = await signIdToken(
      { email: "owner@example.com", sub: "user-123" },
      { audience: "some-other-client" },
    );

    await expect(
      verifyAccessIdToken(token, testEnv, { jwks: localJwks, issuer: ISSUER }),
    ).rejects.toThrow();
  });

  it("rejects a token from an unexpected issuer (e.g. a different Access app)", async () => {
    const token = await signIdToken(
      { email: "owner@example.com", sub: "user-123" },
      {
        issuer:
          "https://canshi-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/some-other-client",
      },
    );

    await expect(
      verifyAccessIdToken(token, testEnv, { jwks: localJwks, issuer: ISSUER }),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await signIdToken(
      { email: "owner@example.com", sub: "user-123" },
      { expiresIn: "-1m" },
    );

    await expect(
      verifyAccessIdToken(token, testEnv, { jwks: localJwks, issuer: ISSUER }),
    ).rejects.toThrow();
  });

  it("rejects a token with no email claim", async () => {
    const token = await signIdToken({ sub: "user-123" });

    await expect(
      verifyAccessIdToken(token, testEnv, { jwks: localJwks, issuer: ISSUER }),
    ).rejects.toThrow(/email クレーム/);
  });
});
