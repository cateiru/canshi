import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOidcDiscoveryDocument } from "./discovery";

const VALID_DOCUMENT = {
  issuer:
    "https://canshi-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/client-id",
  authorization_endpoint:
    "https://canshi-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/client-id/authorization",
  token_endpoint:
    "https://canshi-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/client-id/token",
  jwks_uri:
    "https://canshi-test.cloudflareaccess.com/cdn-cgi/access/sso/oidc/client-id/jwks",
};

// discovery のキャッシュはモジュールスコープ（discoveryUrl 単位）で
// テスト間をまたいで共有されるため、テストごとに固有の URL を使う
let discoveryUrlCounter = 0;
function uniqueDiscoveryUrl(): string {
  discoveryUrlCounter += 1;
  return `https://canshi-test.cloudflareaccess.com/test-${discoveryUrlCounter}/.well-known/openid-configuration`;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getOidcDiscoveryDocument", () => {
  it("fetches and returns the discovery document", async () => {
    const url = uniqueDiscoveryUrl();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(VALID_DOCUMENT));

    const doc = await getOidcDiscoveryDocument(url);

    expect(doc).toEqual(VALID_DOCUMENT);
    expect(fetch).toHaveBeenCalledWith(url);
  });

  it("caches the document and fetches only once for repeated calls to the same URL", async () => {
    const url = uniqueDiscoveryUrl();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(VALID_DOCUMENT));

    await getOidcDiscoveryDocument(url);
    await getOidcDiscoveryDocument(url);
    const doc = await getOidcDiscoveryDocument(url);

    expect(doc).toEqual(VALID_DOCUMENT);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent calls into a single fetch", async () => {
    const url = uniqueDiscoveryUrl();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(VALID_DOCUMENT));

    const [a, b] = await Promise.all([
      getOidcDiscoveryDocument(url),
      getOidcDiscoveryDocument(url),
    ]);

    expect(a).toEqual(VALID_DOCUMENT);
    expect(b).toEqual(VALID_DOCUMENT);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws and does not cache a failure when the response is not ok", async () => {
    const url = uniqueDiscoveryUrl();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(VALID_DOCUMENT));

    await expect(getOidcDiscoveryDocument(url)).rejects.toThrow(/500/);

    // 失敗した結果はキャッシュされず、次の呼び出しで再度 fetch される
    const doc = await getOidcDiscoveryDocument(url);
    expect(doc).toEqual(VALID_DOCUMENT);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws when a required field is missing", async () => {
    const url = uniqueDiscoveryUrl();
    const { jwks_uri: _jwks_uri, ...withoutJwksUri } = VALID_DOCUMENT;
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(withoutJwksUri));

    await expect(getOidcDiscoveryDocument(url)).rejects.toThrow(/jwks_uri/);
  });
});
