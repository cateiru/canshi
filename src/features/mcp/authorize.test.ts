// @vitest-environment node
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `@cloudflare/workers-oauth-provider` は Workers のランタイムにしか無い
// `cloudflare:workers` を import し Node.js では読み込めないため、使うクラスだけを置き換える
vi.mock("@cloudflare/workers-oauth-provider", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    readonly code: string;
    readonly description: string;
    readonly redirectUri?: string;
    readonly state?: string;
    readonly issuer?: string;
    // 実物はライブラリが戻り先を確かめたときだけ組み立てる。テストでは後から付ける
    readonly redirectTo?: string;
    constructor(
      code: string,
      options: {
        description: string;
        redirectUri?: string;
        state?: string;
        issuer?: string;
      },
    ) {
      super(options.description);
      this.code = code;
      this.description = options.description;
      this.redirectUri = options.redirectUri;
      this.state = options.state;
      this.issuer = options.issuer;
    }
  },
  CimdFetchError: class CimdFetchError extends Error {},
}));

vi.mock("@/features/auth/sessions", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("./permissions", () => ({
  saveMcpPermissionsFromForm: vi.fn(async () => true),
}));

const { AuthorizationError, CimdFetchError } = await import(
  "@cloudflare/workers-oauth-provider"
);
const { getSessionUser } = await import("@/features/auth/sessions");
const { saveMcpPermissionsFromForm } = await import("./permissions");
const { decodeMcpConsentRequest, MCP_CONSENT_HEADER } = await import(
  "./consent"
);
const { withMcpAuthorize } = await import("./authorize");

const ORIGIN = "https://canshi.example.test";
const AUTHORIZE_QUERY =
  "response_type=code&client_id=client-1&redirect_uri=https%3A%2F%2Fclient.example.test%2Fcb&state=xyz&code_challenge=abc&code_challenge_method=S256";
const AUTHORIZE_URL = `${ORIGIN}/oauth/authorize?${AUTHORIZE_QUERY}`;

const authRequest = {
  responseType: "code",
  clientId: "client-1",
  redirectUri: "https://client.example.test/cb",
  scope: [],
  state: "xyz",
  codeChallenge: "abc",
  codeChallengeMethod: "S256",
  issuer: ORIGIN,
};

function setup() {
  const helpers = {
    parseAuthRequest: vi.fn(async () => authRequest),
    lookupClient: vi.fn(async () => ({ clientName: "テストのアプリ" })),
    completeAuthorization: vi.fn(async () => ({
      redirectTo: "https://client.example.test/cb?code=the-code&state=xyz",
    })),
  };
  const next = { fetch: vi.fn(async () => new Response("next")) };
  const env = {
    DB: {} as D1Database,
    OAUTH_PROVIDER: helpers as unknown as OAuthHelpers,
  } as unknown as Env;
  const handler = withMcpAuthorize(next);
  const fetch = (request: Request) =>
    // biome-ignore lint/style/noNonNullAssertion: withMcpAuthorize は fetch を必ず返す
    handler.fetch!(
      request as Parameters<NonNullable<typeof handler.fetch>>[0],
      env,
      {} as ExecutionContext,
    );
  return { helpers, next, fetch };
}

const DEFAULT_HEADERS = {
  Origin: ORIGIN,
  Cookie: "canshi-session=session-token",
};

function approvalRequest(
  decision: string,
  headers: Record<string, string> = DEFAULT_HEADERS,
  fields: Record<string, string> = {},
) {
  return new Request(AUTHORIZE_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams({ decision, ...fields }),
  });
}

const PERMISSIONS_FIELD = {
  mcpPermissions: JSON.stringify({
    excludedHouseholdIds: [],
    excludedCatIds: ["cat-1"],
    excludedRecordTypes: {},
  }),
};

beforeEach(() => {
  vi.mocked(getSessionUser).mockReset();
  vi.mocked(saveMcpPermissionsFromForm).mockClear();
});

describe("withMcpAuthorize", () => {
  it("外部から付けられた同意画面用のヘッダーは取り除いて Next.js に渡す", async () => {
    const { next, fetch } = setup();

    await fetch(
      new Request(`${ORIGIN}/home`, {
        headers: { [MCP_CONSENT_HEADER]: "spoofed" },
      }),
    );

    const [request] = next.fetch.mock.calls[0] as unknown as [Request];
    expect(request.headers.has(MCP_CONSENT_HEADER)).toBe(false);
  });

  it("GET では認可リクエストを検証し、クライアントの情報を付けて同意画面へ渡す", async () => {
    const { helpers, next, fetch } = setup();

    const response = await fetch(
      new Request(AUTHORIZE_URL, {
        headers: { [MCP_CONSENT_HEADER]: "spoofed" },
      }),
    );

    expect(helpers.lookupClient).toHaveBeenCalledWith("client-1");
    const [request] = next.fetch.mock.calls[0] as unknown as [Request];
    expect(request.url).toBe(AUTHORIZE_URL);
    expect(
      decodeMcpConsentRequest(request.headers.get(MCP_CONSENT_HEADER)),
    ).toEqual({
      clientId: "client-1",
      clientName: "テストのアプリ",
      redirectUri: "https://client.example.test/cb",
    });
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(await response.text()).toBe("next");
  });

  it("GET で戻り先のわからない不正なリクエストは 400 にし、同意画面を出さない", async () => {
    const { helpers, next, fetch } = setup();
    helpers.parseAuthRequest.mockRejectedValueOnce(
      new AuthorizationError("invalid_request", {
        description: "Invalid client_id",
      }),
    );

    const response = await fetch(new Request(AUTHORIZE_URL));

    expect(response.status).toBe(400);
    expect(next.fetch).not.toHaveBeenCalled();
  });

  it("GET で戻り先を確かめられた不正なリクエストは、ライブラリが組み立てたエラーの戻り先へ戻す", async () => {
    const { helpers, fetch } = setup();
    const redirectTo =
      "https://client.example.test/cb?error=invalid_request&error_description=PKCE+is+required&state=xyz";
    helpers.parseAuthRequest.mockRejectedValueOnce(
      Object.assign(
        new AuthorizationError("invalid_request", {
          description: "PKCE is required",
          redirectUri: "https://client.example.test/cb",
          state: "xyz",
        }),
        { redirectTo },
      ),
    );

    const response = await fetch(new Request(AUTHORIZE_URL));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(redirectTo);
  });

  it("GET で戻り先を確かめられなかった不正なリクエストは、戻り先があっても戻さず 400 にする", async () => {
    const { helpers, next, fetch } = setup();
    helpers.parseAuthRequest.mockRejectedValueOnce(
      new AuthorizationError("invalid_request", {
        description: "Invalid redirect URI",
        redirectUri: "https://attacker.example.test/cb",
        state: "xyz",
      }),
    );

    const response = await fetch(new Request(AUTHORIZE_URL));

    expect(response.status).toBe(400);
    expect(next.fetch).not.toHaveBeenCalled();
  });

  it("GET でクライアントの情報を置いた URL（CIMD）を取得できなければ 400 にする", async () => {
    const { helpers, next, fetch } = setup();
    helpers.parseAuthRequest.mockRejectedValueOnce(
      new CimdFetchError(
        "https://client.example.test/client-metadata.json",
        new Error("fetch failed"),
      ),
    );

    const response = await fetch(new Request(AUTHORIZE_URL));

    expect(response.status).toBe(400);
    expect(next.fetch).not.toHaveBeenCalled();
  });

  it("POST の「許可する」で、ログイン中のユーザーで認可を完了してクライアントへ戻す", async () => {
    const { helpers, fetch } = setup();
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user-1",
    } as Awaited<ReturnType<typeof getSessionUser>>);

    const response = await fetch(approvalRequest("approve"));

    expect(getSessionUser).toHaveBeenCalledWith("session-token", {});
    expect(helpers.completeAuthorization).toHaveBeenCalledWith({
      request: authRequest,
      userId: "user-1",
      metadata: { clientName: "テストのアプリ" },
      scope: [],
      props: { userId: "user-1" },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://client.example.test/cb?code=the-code&state=xyz",
    );
  });

  it("POST の「許可する」で、選んだ読み取りの範囲をその接続の範囲として保存してから認可を完了する", async () => {
    const { helpers, fetch } = setup();
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user-1",
    } as Awaited<ReturnType<typeof getSessionUser>>);

    const response = await fetch(
      approvalRequest("approve", DEFAULT_HEADERS, PERMISSIONS_FIELD),
    );

    expect(saveMcpPermissionsFromForm).toHaveBeenCalledTimes(1);
    const [userId, clientId, formData, d1] = vi.mocked(
      saveMcpPermissionsFromForm,
    ).mock.calls[0];
    expect(userId).toBe("user-1");
    expect(clientId).toBe("client-1");
    expect(formData.get("mcpPermissions")).toBe(
      PERMISSIONS_FIELD.mcpPermissions,
    );
    expect(d1).toEqual({});
    expect(helpers.completeAuthorization).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(303);
  });

  it("POST の「許可する」で読み取りの範囲が正しくなければ、認可せずに 400 にする", async () => {
    const { helpers, fetch } = setup();
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user-1",
    } as Awaited<ReturnType<typeof getSessionUser>>);
    vi.mocked(saveMcpPermissionsFromForm).mockResolvedValueOnce(false);

    const response = await fetch(
      approvalRequest("approve", DEFAULT_HEADERS, { mcpPermissions: "{" }),
    );

    expect(response.status).toBe(400);
    expect(helpers.completeAuthorization).not.toHaveBeenCalled();
  });

  it("POST の「許可する」で読み取りの範囲の項目が無ければ、範囲は変えずに認可を完了する", async () => {
    const { helpers, fetch } = setup();
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user-1",
    } as Awaited<ReturnType<typeof getSessionUser>>);

    const response = await fetch(approvalRequest("approve"));

    expect(saveMcpPermissionsFromForm).not.toHaveBeenCalled();
    expect(helpers.completeAuthorization).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(303);
  });

  it("POST の「許可しない」では認可せず、access_denied を付けてクライアントへ戻す", async () => {
    const { helpers, fetch } = setup();
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user-1",
    } as Awaited<ReturnType<typeof getSessionUser>>);

    const response = await fetch(
      approvalRequest("deny", DEFAULT_HEADERS, PERMISSIONS_FIELD),
    );

    expect(helpers.completeAuthorization).not.toHaveBeenCalled();
    // 許可しないときは、読み取りの範囲も変えない
    expect(saveMcpPermissionsFromForm).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("state")).toBe("xyz");
    expect(location.searchParams.get("iss")).toBe(ORIGIN);
  });

  it("POST が別サイトから送られた場合は 403 にする", async () => {
    const { helpers, fetch } = setup();
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "user-1",
    } as Awaited<ReturnType<typeof getSessionUser>>);

    const crossSiteHeaders: Record<string, string>[] = [
      { Origin: "https://evil.example.test", Cookie: "canshi-session=t" },
      { Cookie: "canshi-session=t" },
    ];
    for (const headers of crossSiteHeaders) {
      const response = await fetch(approvalRequest("approve", headers));
      expect(response.status).toBe(403);
    }
    expect(helpers.completeAuthorization).not.toHaveBeenCalled();
  });

  it("POST で未ログインならログイン画面へ送り、ログイン後に同意画面へ戻す", async () => {
    const { helpers, fetch } = setup();
    // beforeEach で戻り値を消しているため、セッションに対応するユーザーはいない

    const response = await fetch(approvalRequest("approve"));

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe(
      `/oauth/authorize?${AUTHORIZE_QUERY}`,
    );
    expect(helpers.completeAuthorization).not.toHaveBeenCalled();
  });

  it("OAuthProvider が処理しない /.well-known/ 配下はログイン画面へ送らず 404 にする", async () => {
    const { next, fetch } = setup();

    for (const path of [
      "/.well-known/oauth-authorization-server/mcp",
      "/.well-known/openid-configuration/mcp",
    ]) {
      const response = await fetch(new Request(`${ORIGIN}${path}`));
      expect(response.status).toBe(404);
    }
    expect(next.fetch).not.toHaveBeenCalled();
  });

  it("OIDC discovery には OAuth のエンドポイントを返す", async () => {
    const { next, fetch } = setup();

    const response = await fetch(
      new Request(`${ORIGIN}/.well-known/openid-configuration`),
    );

    expect(next.fetch).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      registration_endpoint: `${ORIGIN}/oauth/register`,
      client_id_metadata_document_supported: true,
    });
  });
});
