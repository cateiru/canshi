import { describe, expect, it } from "vitest";
import { isPublicPath } from "./publicPaths";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/login?callbackUrl=%2Fcats",
    "/manifest.webmanifest",
    "/sw.js",
    "/offline",
    "/icons/icon-192.png",
    "/images/bcs/bcs-1-fill.png",
    "/opengraph-image.png",
    "/help",
    "/help/feeding-modes",
    "/help/records/poop-records",
    "/settings/appearance",
    // API トークンで認証する
    "/api/v1",
    "/api/v1/cats/cat-1/timeline",
  ])("%s はログインなしで取得できる", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/home",
    "/cats",
    "/cats/abc/poop-records",
    "/settings",
    "/settings/account",
    "/settings/appearance-other",
    "/api/auth/session",
    "/api/v10",
    "/api",
    "/api/media",
    "/api/media/uploads",
    "/media/asset-1",
    "/helper",
  ])("%s はログインが必要", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
