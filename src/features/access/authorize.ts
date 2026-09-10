import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

export type CloudflareAccessSettings = {
  audience?: string;
  bypass?: string;
  teamDomain?: string;
};

export type CloudflareAccessAuthorization =
  | { authorized: true; bypassed: boolean }
  | {
      authorized: false;
      reason: "invalid_configuration" | "invalid_token" | "missing_token";
    };

type ValidatedAccessSettings = {
  audience: string;
  issuer: string;
};

// Cloudflare Access の公開鍵だけを保持する isolate 単位のキャッシュ。
// リクエスト固有の情報や JWT は保存しない。
const remoteJwks = new Map<string, JWTVerifyGetKey>();

function validateSettings(
  settings: CloudflareAccessSettings,
): ValidatedAccessSettings | null {
  const audience = settings.audience?.trim();
  const teamDomain = settings.teamDomain?.trim();
  if (!audience || !teamDomain) {
    return null;
  }

  try {
    const url = new URL(teamDomain);
    const isCloudflareTeamDomain =
      url.hostname.endsWith(".cloudflareaccess.com") &&
      url.hostname !== "cloudflareaccess.com";
    const hasOnlyOrigin =
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password &&
      !url.port;

    if (
      url.protocol !== "https:" ||
      !isCloudflareTeamDomain ||
      !hasOnlyOrigin
    ) {
      return null;
    }

    return { audience, issuer: url.origin };
  } catch {
    return null;
  }
}

function getRemoteJwks(issuer: string): JWTVerifyGetKey {
  const cached = remoteJwks.get(issuer);
  if (cached) {
    return cached;
  }

  const resolver = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
  remoteJwks.set(issuer, resolver);
  return resolver;
}

async function verifyCloudflareAccessJwt(
  token: string,
  settings: ValidatedAccessSettings,
  keyResolver: JWTVerifyGetKey = getRemoteJwks(settings.issuer),
): Promise<void> {
  await jwtVerify(token, keyResolver, {
    algorithms: ["RS256"],
    audience: settings.audience,
    issuer: settings.issuer,
  });
}

export async function authorizeCloudflareAccess(
  request: Request,
  settings: CloudflareAccessSettings,
  keyResolver?: JWTVerifyGetKey,
): Promise<CloudflareAccessAuthorization> {
  if (settings.bypass === "true") {
    return { authorized: true, bypassed: true };
  }

  const validatedSettings = validateSettings(settings);
  if (!validatedSettings) {
    return { authorized: false, reason: "invalid_configuration" };
  }

  const token = request.headers.get(ACCESS_JWT_HEADER);
  if (!token) {
    return { authorized: false, reason: "missing_token" };
  }

  try {
    await verifyCloudflareAccessJwt(token, validatedSettings, keyResolver);
    return { authorized: true, bypassed: false };
  } catch {
    return { authorized: false, reason: "invalid_token" };
  }
}
