import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIA_LIMITS,
  formatBytes,
  hasStorageCapacity,
  isWithinFileLimit,
  resolveMediaLimits,
} from "./limits";

describe("resolveMediaLimits", () => {
  it("未設定なら既定値を返す", () => {
    expect(resolveMediaLimits({})).toEqual(DEFAULT_MEDIA_LIMITS);
  });

  it("環境変数で上書きできる", () => {
    expect(
      resolveMediaLimits({
        MEDIA_MAX_IMAGE_BYTES: "1000",
        MEDIA_MAX_VIDEO_BYTES: "2000",
        MEDIA_STORAGE_LIMIT_BYTES: "3000",
      }),
    ).toEqual({
      maxImageBytes: 1000,
      maxVideoBytes: 2000,
      storageLimitBytes: 3000,
    });
  });

  it("不正な値は既定値にフォールバックする", () => {
    expect(
      resolveMediaLimits({
        MEDIA_MAX_IMAGE_BYTES: "abc",
        MEDIA_MAX_VIDEO_BYTES: "-1",
        MEDIA_STORAGE_LIMIT_BYTES: "1.5",
      }),
    ).toEqual(DEFAULT_MEDIA_LIMITS);
  });
});

describe("上限判定", () => {
  const limits = {
    maxImageBytes: 100,
    maxVideoBytes: 1000,
    storageLimitBytes: 5000,
  };

  it("種別ごとの 1 ファイル上限を判定する", () => {
    expect(isWithinFileLimit("image", 100, limits)).toBe(true);
    expect(isWithinFileLimit("image", 101, limits)).toBe(false);
    expect(isWithinFileLimit("video", 1000, limits)).toBe(true);
    expect(isWithinFileLimit("video", 1001, limits)).toBe(false);
  });

  it("保存容量の残りを判定する", () => {
    expect(hasStorageCapacity(4000, 1000, limits)).toBe(true);
    expect(hasStorageCapacity(4000, 1001, limits)).toBe(false);
  });
});

describe("formatBytes", () => {
  it("読みやすい単位に変換する", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe("10 GB");
  });
});
