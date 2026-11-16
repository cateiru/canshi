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
  ])("%s はログインなしで取得できる", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/home",
    "/cats",
    "/cats/abc/poop-records",
    "/settings",
    "/api/auth/session",
    "/api/media",
    "/api/media/uploads",
    "/media/asset-1",
    "/helper",
  ])("%s はログインが必要", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
