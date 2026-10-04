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
