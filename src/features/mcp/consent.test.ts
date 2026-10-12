import { describe, expect, it } from "vitest";
import { decodeMcpConsentRequest, encodeMcpConsentRequest } from "./consent";

describe("encodeMcpConsentRequest / decodeMcpConsentRequest", () => {
  it("日本語のクライアント名も ASCII のヘッダー値にして戻せる", () => {
    const request = {
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
          clientName: null,
          redirectUri: "https://example.com/cb",
        }),
      ),
    ).toEqual({ clientName: null, redirectUri: "https://example.com/cb" });
    expect(
      decodeMcpConsentRequest(
        encodeURIComponent(
          JSON.stringify({ clientName: "", redirectUri: "x:/cb" }),
        ),
      ),
    ).toEqual({ clientName: null, redirectUri: "x:/cb" });
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
        encodeURIComponent(JSON.stringify({ clientName: 1, redirectUri: "a" })),
      ),
    ).toBeNull();
  });
});
