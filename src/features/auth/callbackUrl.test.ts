import { describe, expect, it } from "vitest";
import { DEFAULT_CALLBACK_URL, sanitizeCallbackUrl } from "./callbackUrl";

describe("sanitizeCallbackUrl", () => {
  it("アプリ内のパスはそのまま返す", () => {
    expect(sanitizeCallbackUrl("/cats/abc?month=2026-10")).toBe(
      "/cats/abc?month=2026-10",
    );
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
  ])("%s は既定値にする", (value) => {
    expect(sanitizeCallbackUrl(value)).toBe(DEFAULT_CALLBACK_URL);
  });
});
