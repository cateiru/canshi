import { describe, expect, it } from "vitest";
import {
  API_TOKEN_PREFIX,
  apiTokenExpiresAt,
  generateApiToken,
  hashApiToken,
  isApiTokenExpired,
  readBearerToken,
} from "./apiToken";

const NOW = new Date("2026-11-24T00:00:00Z");

describe("apiTokenExpiresAt", () => {
  it.each([
    ["1d", "2026-11-25T00:00:00Z"],
    ["7d", "2026-12-01T00:00:00Z"],
    ["30d", "2026-12-24T00:00:00Z"],
    ["90d", "2027-02-22T00:00:00Z"],
  ] as const)("%s なら、その日数の後の日時にする", (expiration, expected) => {
    expect(apiTokenExpiresAt(expiration, NOW)).toEqual(new Date(expected));
  });

  it("期限なしなら null にする", () => {
    expect(apiTokenExpiresAt("none", NOW)).toBeNull();
  });
});

describe("isApiTokenExpired", () => {
  it("期限の日時になったら切れたものとして扱う", () => {
    expect(
      isApiTokenExpired({ expiresAt: new Date(NOW.getTime() + 1) }, NOW),
    ).toBe(false);
    expect(isApiTokenExpired({ expiresAt: NOW }, NOW)).toBe(true);
  });

  it("期限なしのトークンは切れない", () => {
    expect(isApiTokenExpired({ expiresAt: null }, NOW)).toBe(false);
  });
});

describe("generateApiToken", () => {
  it("先頭の文字列を付けた、毎回違うトークンを作る", async () => {
    const token = generateApiToken();
    expect(token).toMatch(/^canshi_[A-Za-z0-9_-]{43}$/);
    expect(generateApiToken()).not.toBe(token);
    expect(await hashApiToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("readBearerToken", () => {
  it("Bearer のトークンを取り出す", () => {
    expect(readBearerToken(`Bearer ${API_TOKEN_PREFIX}abc`)).toBe("canshi_abc");
    expect(readBearerToken("bearer canshi_abc")).toBe("canshi_abc");
  });

  it.each([
    null,
    "",
    "canshi_abc",
    "Basic canshi_abc",
    "Bearer abc",
    "Bearer canshi_abc def",
  ])("%s は受け付けない", (authorization) => {
    expect(readBearerToken(authorization)).toBeNull();
  });
});
