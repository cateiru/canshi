import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { isLocalDevBypass, verifyAccessJwt } from "./access";

const TEAM_DOMAIN = "https://example.cloudflareaccess.com";
const AUD = "test-aud";

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "test", alg: "RS256" }] });
});

function sign(claims: { iss?: string; aud?: string; email?: string }) {
  const jwt = new SignJWT(claims.email ? { email: claims.email } : {})
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuedAt()
    .setExpirationTime("5m");
  if (claims.iss) jwt.setIssuer(claims.iss);
  if (claims.aud) jwt.setAudience(claims.aud);
  return jwt.sign(privateKey);
}

describe("verifyAccessJwt", () => {
  const config = { teamDomain: TEAM_DOMAIN, aud: AUD };

  it("Team domain・AUD が一致する JWT からメールアドレスを取り出す", async () => {
    const token = await sign({
      iss: TEAM_DOMAIN,
      aud: AUD,
      email: "admin@example.com",
    });
    await expect(verifyAccessJwt(token, config, jwks)).resolves.toEqual({
      email: "admin@example.com",
    });
  });

  it("別のアプリ（AUD）向けの JWT を拒否する", async () => {
    const token = await sign({
      iss: TEAM_DOMAIN,
      aud: "other-app",
      email: "admin@example.com",
    });
    await expect(verifyAccessJwt(token, config, jwks)).rejects.toThrow();
  });

  it("別の Team domain が発行した JWT を拒否する", async () => {
    const token = await sign({
      iss: "https://other.cloudflareaccess.com",
      aud: AUD,
      email: "admin@example.com",
    });
    await expect(verifyAccessJwt(token, config, jwks)).rejects.toThrow();
  });

  it("email クレームの無い JWT（サービストークン等）を拒否する", async () => {
    const token = await sign({ iss: TEAM_DOMAIN, aud: AUD });
    await expect(verifyAccessJwt(token, config, jwks)).rejects.toThrow(
      "email クレーム",
    );
  });
});

describe("isLocalDevBypass", () => {
  it("フラグがあり、ホスト名が localhost のときだけ省略する", () => {
    expect(isLocalDevBypass("http://localhost:8787/", "true")).toBe(true);
    expect(isLocalDevBypass("http://127.0.0.1:8787/users", "true")).toBe(true);
  });

  it("本番のホスト名ではフラグがあっても省略しない", () => {
    expect(isLocalDevBypass("https://canshi-admin.cateiru.dev/", "true")).toBe(
      false,
    );
  });

  it("フラグが無ければ localhost でも省略しない", () => {
    expect(isLocalDevBypass("http://localhost:8787/", undefined)).toBe(false);
    expect(isLocalDevBypass("http://localhost:8787/", "false")).toBe(false);
  });
});
