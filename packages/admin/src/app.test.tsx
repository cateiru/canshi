import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { ACCESS_JWT_HEADER } from "./auth/access";
import { createMigratedDatabase, toAdminDb } from "./test/d1";
import { seed } from "./test/fixtures";

const TEAM_DOMAIN = "https://example.cloudflareaccess.com";
const AUD = "test-aud";

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;
let env: Env;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "test", alg: "RS256" }] });
});

beforeEach(async () => {
  const database = await createMigratedDatabase();
  seed(database);
  env = {
    DB: toAdminDb(database) as D1Database,
    ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    ACCESS_AUD: AUD,
  };
});

function validToken() {
  return new SignJWT({ email: "admin@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(TEAM_DOMAIN)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

async function request(path: string, headers: Record<string, string> = {}) {
  const app = createApp({ jwks });
  return app.request(
    `https://canshi-admin.cateiru.dev${path}`,
    { headers },
    env,
  );
}

describe("Access による保護", () => {
  it("Access の JWT が無いリクエストを拒否する", async () => {
    const response = await request("/users");
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("たろう");
  });

  it("不正な JWT を拒否する", async () => {
    const response = await request("/users", {
      [ACCESS_JWT_HEADER]: "invalid",
    });
    expect(response.status).toBe(403);
  });

  it("ACCESS_AUD が未設定なら、JWT があっても拒否する", async () => {
    env.ACCESS_AUD = "";
    const response = await request("/", {
      [ACCESS_JWT_HEADER]: await validToken(),
    });
    expect(response.status).toBe(403);
  });

  it("本番のホスト名では ACCESS_DEV_BYPASS を無視する", async () => {
    env.ACCESS_DEV_BYPASS = "true";
    const response = await request("/");
    expect(response.status).toBe(403);
  });

  it("localhost では ACCESS_DEV_BYPASS で検証を省略できる", async () => {
    env.ACCESS_DEV_BYPASS = "true";
    const app = createApp({ jwks });
    const response = await app.request("http://localhost:8787/", {}, env);
    expect(response.status).toBe(200);
  });
});

describe("画面", () => {
  it("概要に件数と、家に未所属の猫の警告を表示する", async () => {
    const response = await request("/", {
      [ACCESS_JWT_HEADER]: await validToken(),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("admin@example.com");
    expect(html).toContain("家に所属していない猫が 1");
  });

  it("ユーザー一覧で、利用者の入力した名前をエスケープして表示する", async () => {
    const response = await request("/users", {
      [ACCESS_JWT_HEADER]: await validToken(),
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("たろう");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    // セッションのトークン（ハッシュ）は表示しない
    expect(html).not.toContain("hash-active-1");
  });

  it("家の一覧に、メンバーと猫の数を表示する", async () => {
    const response = await request("/households", {
      [ACCESS_JWT_HEADER]: await validToken(),
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("わが家");
    expect(html).toContain("たろう（オーナー）");
  });
});
