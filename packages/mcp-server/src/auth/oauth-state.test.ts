import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createOAuthState,
  getUpstreamAuthorizeUrl,
  validateOAuthState,
} from "./oauth-state";

const SECRET = "test-secret";

function createFakeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  } as unknown as KVNamespace;
}

const oauthReqInfo: AuthRequest = {
  responseType: "code",
  clientId: "client-1",
  redirectUri: "https://chatgpt.example/callback",
  scope: ["cats:read"],
  state: "client-state",
};

describe("createOAuthState / validateOAuthState", () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createFakeKv();
  });

  it("stores and retrieves the original oauthReqInfo and a verifiable PKCE pair", async () => {
    const { stateToken, codeChallenge } = await createOAuthState(
      oauthReqInfo,
      kv,
      SECRET,
    );

    const callbackRequest = new Request(
      `https://mcp.example.test/callback?state=${encodeURIComponent(stateToken)}`,
    );
    const result = await validateOAuthState(callbackRequest, kv, SECRET);

    expect(result.oauthReqInfo).toEqual(oauthReqInfo);

    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(result.codeVerifier),
    );
    const expectedChallenge = btoa(
      String.fromCharCode(...new Uint8Array(digest)),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    expect(codeChallenge).toBe(expectedChallenge);
  });

  it("rejects a state token whose signature was tampered with", async () => {
    const { stateToken } = await createOAuthState(oauthReqInfo, kv, SECRET);
    const [uuid] = stateToken.split(".");
    const forged = `${uuid}.${"0".repeat(64)}`;

    const request = new Request(
      `https://mcp.example.test/callback?state=${forged}`,
    );
    await expect(validateOAuthState(request, kv, SECRET)).rejects.toThrow(
      /署名が不正/,
    );
  });

  it("rejects a state token signed with a different secret", async () => {
    const { stateToken } = await createOAuthState(
      oauthReqInfo,
      kv,
      "other-secret",
    );
    const request = new Request(
      `https://mcp.example.test/callback?state=${encodeURIComponent(stateToken)}`,
    );
    await expect(validateOAuthState(request, kv, SECRET)).rejects.toThrow(
      /署名が不正/,
    );
  });

  it("rejects reusing the same state token twice (one-time use)", async () => {
    const { stateToken } = await createOAuthState(oauthReqInfo, kv, SECRET);
    const request = new Request(
      `https://mcp.example.test/callback?state=${encodeURIComponent(stateToken)}`,
    );

    await validateOAuthState(request, kv, SECRET);
    await expect(validateOAuthState(request, kv, SECRET)).rejects.toThrow(
      /無効、または期限切れ/,
    );
  });

  it("rejects a request with no state parameter", async () => {
    const request = new Request("https://mcp.example.test/callback");
    await expect(validateOAuthState(request, kv, SECRET)).rejects.toThrow(
      /state パラメータがありません/,
    );
  });
});

describe("getUpstreamAuthorizeUrl", () => {
  it("builds an authorization URL with PKCE parameters", () => {
    const url = getUpstreamAuthorizeUrl({
      upstream_url: "https://team.cloudflareaccess.com/authorize",
      client_id: "access-client-id",
      redirect_uri: "https://mcp.example.test/callback",
      scope: "openid email profile",
      state: "signed-state",
      code_challenge: "challenge-value",
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://team.cloudflareaccess.com/authorize",
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("state")).toBe("signed-state");
  });
});
