import { describe, expect, it } from "vitest";
import { DEFAULT_CALLBACK_URL, sanitizeCallbackUrl } from "./callbackUrl";

describe("sanitizeCallbackUrl", () => {
  it("アプリ内のパスはそのまま返す", () => {
    expect(sanitizeCallbackUrl("/cats/abc?month=2026-10")).toBe(
      "/cats/abc?month=2026-10",
    );
    expect(sanitizeCallbackUrl("/cats/abc#weight")).toBe("/cats/abc#weight");
    // パーセントエンコードされたタブはパスの一部のままで、外部への遷移にはならない
    expect(sanitizeCallbackUrl("/%09/evil.example")).toBe("/%09/evil.example");
  });

  it("家への招待 URL（base64url のトークンを含む）はそのまま返す", () => {
    const path = "/invitations/Ab0-_Zz9xY8wV7uT6sR5qP4oN3mL2kJ1iH0gF9eD8cB";
    expect(sanitizeCallbackUrl(path)).toBe(path);
  });

  it.each([
    undefined,
    null,
    "",
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "cats",
    "/login",
    "/login?callbackUrl=%2Fcats",
    // ブラウザは URL のタブ・改行を取り除くため、`//evil.example` として外部へ遷移してしまう
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/cats\u0000",
    // パスとして解釈すると `/login` になるもの
    "/./login",
    "/cats/../login?callbackUrl=%2F",
  ])("%j は既定値にする", (value) => {
    expect(sanitizeCallbackUrl(value)).toBe(DEFAULT_CALLBACK_URL);
  });
});
