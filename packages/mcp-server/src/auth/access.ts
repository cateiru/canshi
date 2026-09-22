import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

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
 * Access for SaaS の JWKS（Key endpoint）・issuer は、Team domain 全体で共通の
 * `/cdn-cgi/access/certs` ではなく、SaaS アプリ（`ACCESS_CLIENT_ID`）ごとに
 * 異なる `https://<team>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/jwks`
 * （issuer は `.../oidc/<client-id>`）になる。ダッシュボードの Key endpoint・
 * Issuer をそのまま `ACCESS_JWKS_URL`・`ACCESS_ISSUER` として設定すること
 * （参考: https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/saas-apps/generic-oidc-saas/）
 *
 * @param jwks JWKS の取得元。省略時は `env.ACCESS_JWKS_URL` から取得する
 *   （本番・`wrangler dev` 用）。テストではローカルに用意した JWKS
 *   （`jose.createLocalJWKSet`）を渡す
 */
export async function verifyAccessIdToken(
  idToken: string,
  env: Pick<Env, "ACCESS_JWKS_URL" | "ACCESS_ISSUER" | "ACCESS_CLIENT_ID">,
  jwks: JWTVerifyGetKey = getRemoteJwks(env.ACCESS_JWKS_URL),
): Promise<AccessIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: env.ACCESS_ISSUER,
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
