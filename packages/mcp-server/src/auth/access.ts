import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import { getOidcDiscoveryDocument } from "./discovery";

export interface AccessIdentity {
  email: string;
  sub: string;
}

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(jwksUrl: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

/**
 * Cloudflare Access（SaaS OIDC アプリ）が発行した ID トークンを検証し、
 * ユーザーの身元（email・sub）を取り出す。
 *
 * issuer・JWKS（Key endpoint）は `env.ACCESS_DISCOVERY_URL`
 * （`.../.well-known/openid-configuration`）から取得する。Access for SaaS の
 * これらの値は Team domain 全体で共通ではなく SaaS アプリ（`ACCESS_CLIENT_ID`）
 * ごとに異なるが、discovery ドキュメント自体はそのアプリ用の値を返すため、
 * URL を1つ設定するだけでよい
 * （参考: https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/saas-apps/generic-oidc-saas/）
 *
 * @param overrides テスト用に issuer・JWKS の取得元を直接指定し、discovery の
 *   fetch を回避する（`jose.createLocalJWKSet` 等）
 */
export async function verifyAccessIdToken(
  idToken: string,
  env: Pick<Env, "ACCESS_DISCOVERY_URL" | "ACCESS_CLIENT_ID">,
  overrides?: { jwks?: JWTVerifyGetKey; issuer?: string },
): Promise<AccessIdentity> {
  let { jwks, issuer } = overrides ?? {};
  if (!jwks || !issuer) {
    const discovery = await getOidcDiscoveryDocument(env.ACCESS_DISCOVERY_URL);
    jwks ??= getRemoteJwks(discovery.jwks_uri);
    issuer ??= discovery.issuer;
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: env.ACCESS_CLIENT_ID,
  });

  if (typeof payload.email !== "string") {
    throw new Error("Access の ID トークンに email クレームがありません");
  }
  if (typeof payload.sub !== "string") {
    throw new Error("Access の ID トークンに sub クレームがありません");
  }

  return { email: payload.email, sub: payload.sub };
}
