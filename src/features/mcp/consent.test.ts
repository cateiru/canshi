import { describe, expect, it } from "vitest";
import {
  decodeMcpConsentRequest,
  encodeMcpConsentRequest,
  formatRedirectUri,
} from "./consent";

describe("encodeMcpConsentRequest / decodeMcpConsentRequest", () => {
  it("日本語のクライアント名も ASCII のヘッダー値にして戻せる", () => {
    const request = {
      clientId: "client-1",
      clientName: "猫のアシスタント",
      redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
    };
    const encoded = encodeMcpConsentRequest(request);

    expect(encoded).toMatch(/^[\x20-\x7e]+$/);
    expect(decodeMcpConsentRequest(encoded)).toEqual(request);
  });

  it("クライアント名が無い・空文字なら null にする", () => {
    expect(
      decodeMcpConsentRequest(
        encodeMcpConsentRequest({
          clientId: "client-1",
          clientName: null,
          redirectUri: "https://example.com/cb",
        }),
      ),
    ).toEqual({
      clientId: "client-1",
      clientName: null,
      redirectUri: "https://example.com/cb",
    });
    expect(
      decodeMcpConsentRequest(
        encodeURIComponent(
          JSON.stringify({
            clientId: "client-1",
            clientName: "",
            redirectUri: "x:/cb",
          }),
        ),
      ),
    ).toEqual({ clientId: "client-1", clientName: null, redirectUri: "x:/cb" });
  });

  it("ヘッダーが無い・壊れている・形が違う場合は null", () => {
    expect(decodeMcpConsentRequest(null)).toBeNull();
    expect(decodeMcpConsentRequest("")).toBeNull();
    expect(decodeMcpConsentRequest("%E0%A4%A")).toBeNull();
    expect(decodeMcpConsentRequest("not-json")).toBeNull();
    expect(
      decodeMcpConsentRequest(encodeURIComponent(JSON.stringify("x"))),
    ).toBeNull();
    expect(
      decodeMcpConsentRequest(
        encodeURIComponent(JSON.stringify({ clientName: "a" })),
      ),
    ).toBeNull();
    expect(
      decodeMcpConsentRequest(
        encodeURIComponent(
          JSON.stringify({ clientId: "c", clientName: 1, redirectUri: "a" }),
        ),
      ),
    ).toBeNull();
    // クライアントの ID が無い
    expect(
      decodeMcpConsentRequest(
        encodeURIComponent(
          JSON.stringify({ clientName: "a", redirectUri: "a" }),
        ),
      ),
    ).toBeNull();
  });
});

describe("formatRedirectUri", () => {
  it("http(s) はホスト名だけ、それ以外は URI 全体を返す", () => {
    expect(
      formatRedirectUri("https://chatgpt.com/connector/oauth/callback"),
    ).toBe("chatgpt.com");
    expect(formatRedirectUri("http://localhost:6274/oauth/callback")).toBe(
      "localhost:6274",
    );
    expect(formatRedirectUri("cursor://anysphere.cursor-mcp/oauth")).toBe(
      "cursor://anysphere.cursor-mcp/oauth",
    );
    expect(formatRedirectUri("not a url")).toBe("not a url");
  });
});
