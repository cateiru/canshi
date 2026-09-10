import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCESS_JWT_HEADER,
  authorizeCloudflareAccess,
  type CloudflareAccessSettings,
} from "./authorize";

const issuer = "https://canshi.cloudflareaccess.com";
const audience = "test-audience";
const settings: CloudflareAccessSettings = {
  audience,
  bypass: "false",
  teamDomain: issuer,
};

let privateKey: CryptoKey;
let untrustedPrivateKey: CryptoKey;
let keyResolver: JWTVerifyGetKey;

async function createToken(
  claims: { audience?: string; issuer?: string } = {},
): Promise<string> {
  return new SignJWT({ email: "cat@example.com", type: "app" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(claims.issuer ?? issuer)
    .setAudience(claims.audience ?? audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256", { extractable: true });
  privateKey = keyPair.privateKey;
  untrustedPrivateKey = (await generateKeyPair("RS256")).privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  keyResolver = createLocalJWKSet({
    keys: [{ ...publicJwk, alg: "RS256", kid: "test-key", use: "sig" }],
  });
});

describe("authorizeCloudflareAccess", () => {
  it("明示的なローカルバイパスでは JWT なしで許可する", async () => {
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com"),
      { bypass: "true" },
    );

    expect(result).toEqual({ authorized: true, bypassed: true });
  });

  it("バイパスは文字列 true の場合だけ有効にする", async () => {
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com"),
      { ...settings, bypass: "TRUE" },
      keyResolver,
    );

    expect(result).toEqual({
      authorized: false,
      reason: "missing_token",
    });
  });

  it("設定が不足している場合は閉じた状態で拒否する", async () => {
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com"),
      {},
    );

    expect(result).toEqual({
      authorized: false,
      reason: "invalid_configuration",
    });
  });

  it("Cloudflare の Team ドメイン以外は拒否する", async () => {
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com"),
      { ...settings, teamDomain: "https://example.com" },
    );

    expect(result).toEqual({
      authorized: false,
      reason: "invalid_configuration",
    });
  });

  it("JWT ヘッダーがない場合は拒否する", async () => {
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com"),
      settings,
      keyResolver,
    );

    expect(result).toEqual({
      authorized: false,
      reason: "missing_token",
    });
  });

  it("署名・issuer・audience が正しい JWT を許可する", async () => {
    const token = await createToken();
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com", {
        headers: { [ACCESS_JWT_HEADER]: token },
      }),
      settings,
      keyResolver,
    );

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.bypassed).toBe(false);
    }
  });

  it("信頼していない鍵による署名を拒否する", async () => {
    const token = await new SignJWT({ type: "app" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(untrustedPrivateKey);
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com", {
        headers: { [ACCESS_JWT_HEADER]: token },
      }),
      settings,
      keyResolver,
    );

    expect(result).toEqual({
      authorized: false,
      reason: "invalid_token",
    });
  });

  it.each([
    ["issuer", { issuer: "https://other.cloudflareaccess.com" }],
    ["audience", { audience: "other-audience" }],
  ])("%s が一致しない JWT を拒否する", async (_name, claims) => {
    const token = await createToken(claims);
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com", {
        headers: { [ACCESS_JWT_HEADER]: token },
      }),
      settings,
      keyResolver,
    );

    expect(result).toEqual({
      authorized: false,
      reason: "invalid_token",
    });
  });

  it("期限切れの JWT を拒否する", async () => {
    const token = await new SignJWT({ type: "app" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(privateKey);
    const result = await authorizeCloudflareAccess(
      new Request("https://example.com", {
        headers: { [ACCESS_JWT_HEADER]: token },
      }),
      settings,
      keyResolver,
    );

    expect(result).toEqual({
      authorized: false,
      reason: "invalid_token",
    });
  });
});
