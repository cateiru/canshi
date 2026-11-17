import { describe, expect, it } from "vitest";
import {
  INSTALL_BANNER_DISMISS_DURATION_MS,
  isInstallBannerDismissed,
  isInstallBannerHiddenPath,
  isIos,
} from "./installBanner";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

describe("isIos", () => {
  it("iPhone は iOS とみなす", () => {
    expect(isIos(IPHONE_UA, 5)).toBe(true);
  });

  it("Mac と同じ UA でもタッチに対応していれば iPad とみなす", () => {
    expect(isIos(MAC_UA, 5)).toBe(true);
  });

  it("タッチに対応していない Mac は iOS とみなさない", () => {
    expect(isIos(MAC_UA, 0)).toBe(false);
  });

  it("Android は iOS とみなさない", () => {
    expect(isIos(ANDROID_UA, 5)).toBe(false);
  });
});

describe("isInstallBannerHiddenPath", () => {
  it.each(["/help/add-to-home-screen", "/oauth/authorize"])(
    "%s では出さない",
    (pathname) => {
      expect(isInstallBannerHiddenPath(pathname)).toBe(true);
    },
  );

  it.each(["/", "/cats", "/help", "/help/notifications", "/login"])(
    "%s では出す",
    (pathname) => {
      expect(isInstallBannerHiddenPath(pathname)).toBe(false);
    },
  );
});

describe("isInstallBannerDismissed", () => {
  const now = Date.UTC(2026, 10, 17);

  it("閉じていなければ出す", () => {
    expect(isInstallBannerDismissed(null, now)).toBe(false);
  });

  it("閉じてから期間の中なら出さない", () => {
    expect(isInstallBannerDismissed(String(now - 1000), now)).toBe(true);
  });

  it("閉じてから期間が過ぎたら出す", () => {
    expect(
      isInstallBannerDismissed(
        String(now - INSTALL_BANNER_DISMISS_DURATION_MS),
        now,
      ),
    ).toBe(false);
  });

  it("読めない値なら出す", () => {
    expect(isInstallBannerDismissed("invalid", now)).toBe(false);
  });
});
