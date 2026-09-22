export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const REQUIRED_FIELDS = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
] as const;

// Worker のアイソレートが再利用される間（コールドスタートごとではない）は
// 同じ discovery URL への fetch を一度だけにする。Access SaaS OIDC アプリの
// エンドポイント構成は作成後に変わらない値のため、TTL は設けない
const discoveryCache = new Map<string, Promise<OidcDiscoveryDocument>>();

/**
 * OIDC discovery エンドポイント（`.../.well-known/openid-configuration`）から
 * issuer・authorization_endpoint・token_endpoint・jwks_uri を取得する。
 * Cloudflare Access の SaaS OIDC アプリはこれらをすべて discovery ドキュメントで
 * 公開しているため、`ACCESS_DISCOVERY_URL` 一つから他の値を導出できる。
 */
export function getOidcDiscoveryDocument(
  discoveryUrl: string,
): Promise<OidcDiscoveryDocument> {
  let cached = discoveryCache.get(discoveryUrl);
  if (!cached) {
    cached = fetchOidcDiscoveryDocument(discoveryUrl).catch((error) => {
      discoveryCache.delete(discoveryUrl);
      throw error;
    });
    discoveryCache.set(discoveryUrl, cached);
  }
  return cached;
}

async function fetchOidcDiscoveryDocument(
  discoveryUrl: string,
): Promise<OidcDiscoveryDocument> {
  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(
      `OIDC discovery document の取得に失敗しました (${response.status}): ${discoveryUrl}`,
    );
  }

  const body = (await response.json()) as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (typeof body[field] !== "string") {
      throw new Error(
        `OIDC discovery document に ${field} がありません: ${discoveryUrl}`,
      );
    }
  }

  return body as unknown as OidcDiscoveryDocument;
}
