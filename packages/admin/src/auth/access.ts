import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

/**
 * Cloudflare Access がオリジン（この Worker）へのリクエストに付ける JWT のヘッダー。
 * Access を通過したリクエストにだけ付く
 */
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

export interface AccessIdentity {
  email: string;
}

export interface AccessConfig {
  /** `https://<team>.cloudflareaccess.com` 形式の Team domain */
  teamDomain: string;
  /** Self-hosted アプリの Application Audience (AUD) Tag */
  aud: string;
}

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Cloudflare Access（Self-hosted アプリ）の JWT を検証し、ログインしたユーザーの
 * メールアドレスを取り出す。
 *
 * MCP サーバー（`packages/mcp-server/src/auth/access.ts`）が検証する SaaS OIDC アプリの
 * ID トークンとは異なり、Self-hosted アプリの JWT は Team domain 共通の
 * `/cdn-cgi/access/certs` の鍵で署名され、issuer は Team domain そのものになる
 * （https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/）
 *
 * @param jwks テスト用に鍵の取得元を差し替える（`jose.createLocalJWKSet` 等）
 */
export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  jwks: JWTVerifyGetKey = getRemoteJwks(config.teamDomain),
): Promise<AccessIdentity> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.teamDomain,
    audience: config.aud,
  });
  if (typeof payload.email !== "string") {
    throw new Error("Access の JWT に email クレームがありません");
  }
  return { email: payload.email };
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * ローカルの `wrangler dev` で Access の検証を省略してよいか。
 * `.dev.vars` の `ACCESS_DEV_BYPASS` が設定されていても、ホスト名が localhost で
 * なければ省略しない（本番の環境変数に誤って設定しても効かないようにする）
 */
export function isLocalDevBypass(url: string, bypass: string | undefined) {
  return bypass === "true" && LOCAL_HOSTNAMES.has(new URL(url).hostname);
}

export type AdminEnv = {
  Bindings: Env;
  Variables: { adminEmail: string };
};

/**
 * すべてのリクエストに Access の JWT を要求するミドルウェア。
 *
 * MCP サーバーのカスタムドメインにはアカウント全体の Access（Protect all Workers）が
 * 適用されなかった（docs/deploy.md 参照）。管理画面は全ユーザー・全家の情報を表示するため、
 * それに頼らず、Zero Trust の Self-hosted アプリによるエッジでの保護に加えて
 * Worker 内でも JWT を検証し、設定漏れのときは表示せずに拒否する（fail closed）
 */
export function requireAccess(options?: {
  jwks?: JWTVerifyGetKey;
}): MiddlewareHandler<AdminEnv> {
  return async (c, next) => {
    if (isLocalDevBypass(c.req.url, c.env.ACCESS_DEV_BYPASS)) {
      c.set("adminEmail", "local-dev");
      return next();
    }

    const config = {
      teamDomain: c.env.ACCESS_TEAM_DOMAIN,
      aud: c.env.ACCESS_AUD,
    };
    if (!config.teamDomain || !config.aud) {
      console.error(
        "ACCESS_TEAM_DOMAIN・ACCESS_AUD が設定されていないため、リクエストを拒否しました",
      );
      return c.text("Forbidden", 403);
    }

    const token = c.req.header(ACCESS_JWT_HEADER);
    if (!token) {
      return c.text("Forbidden", 403);
    }
    try {
      const identity = await verifyAccessJwt(token, config, options?.jwks);
      c.set("adminEmail", identity.email);
    } catch (error) {
      console.error("Access の JWT の検証に失敗しました", error);
      return c.text("Forbidden", 403);
    }
    return next();
  };
}
