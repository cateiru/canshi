import { describe, expect, it } from "vitest";
import {
  formatDeviceName,
  MAX_USER_AGENT_LENGTH,
  normalizeUserAgent,
} from "./deviceName";

describe("formatDeviceName", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      "iPhone・Safari",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1",
      "iPhone・Chrome",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/141.0 Mobile/15E148 Safari/605.1.15",
      "iPhone・Firefox",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 EdgiOS/138.0.3351.83 Mobile/15E148 Safari/605.1.15",
      "iPhone・Edge",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1",
      "iPad・Chrome",
    ],
    // iPadOS の Safari は Mac と同じ UA を送るため、Mac と区別できない
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
      "Mac・Safari",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "Mac・Chrome",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0",
      "Mac・Firefox",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.3351.83",
      "Windows・Edge",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 OPR/120.0.0.0",
      "Windows・Opera",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "Windows・Chrome",
    ],
    [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
      "Android・Chrome",
    ],
    [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      "Android・Samsung Internet",
    ],
    [
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 EdgA/138.0.3351.83",
      "Android・Edge",
    ],
    [
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "ChromeOS・Chrome",
    ],
    // e2e で使うヘッドレスの Chromium
    [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36",
      "Linux・Chrome",
    ],
  ])("%s は「%s」", (userAgent, expected) => {
    expect(formatDeviceName(userAgent)).toBe(expected);
  });

  it("OS かブラウザの片方しか判定できなければ、わかった方だけを返す", () => {
    expect(formatDeviceName("Mozilla/5.0 (Windows NT 10.0) Unknown/1.0")).toBe(
      "Windows",
    );
    expect(formatDeviceName("Firefox/141.0")).toBe("Firefox");
  });

  it("User-Agent がない・判定できないときは「不明な端末」", () => {
    expect(formatDeviceName(null)).toBe("不明な端末");
    expect(formatDeviceName("curl/8.9.1")).toBe("不明な端末");
  });
});

describe("normalizeUserAgent", () => {
  it("前後の空白を除き、長すぎる分を切り捨てる", () => {
    expect(normalizeUserAgent("  Mozilla/5.0  ")).toBe("Mozilla/5.0");
    expect(normalizeUserAgent("a".repeat(MAX_USER_AGENT_LENGTH + 10))).toBe(
      "a".repeat(MAX_USER_AGENT_LENGTH),
    );
  });

  it("空・未指定なら null", () => {
    expect(normalizeUserAgent("")).toBeNull();
    expect(normalizeUserAgent("   ")).toBeNull();
    expect(normalizeUserAgent(null)).toBeNull();
    expect(normalizeUserAgent(undefined)).toBeNull();
  });
});
