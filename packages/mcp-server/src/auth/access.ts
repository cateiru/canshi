import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

export interface AccessIdentity {
  email: string;
  sub: string;
}

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getRemoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Cloudflare Access（SaaS OIDC アプリ）が発行した ID トークンを検証し、
 * ユーザーの身元（email・sub）を取り出す。
 *
 * @param jwks JWKS の取得元。省略時は `env.ACCESS_TEAM_DOMAIN` の
 *   `/cdn-cgi/access/certs` から取得する（本番・`wrangler dev` 用）。
 *   テストではローカルに用意した JWKS（`jose.createLocalJWKSet`）を渡す
 */
export async function verifyAccessIdToken(
  idToken: string,
  env: Pick<Env, "ACCESS_TEAM_DOMAIN" | "ACCESS_CLIENT_ID">,
  jwks: JWTVerifyGetKey = getRemoteJwks(env.ACCESS_TEAM_DOMAIN),
): Promise<AccessIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: env.ACCESS_TEAM_DOMAIN,
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
