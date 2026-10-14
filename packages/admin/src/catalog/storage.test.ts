import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORAGE_LIMIT_BYTES,
  resolveStorageLimitBytes,
} from "./storage";

describe("resolveStorageLimitBytes", () => {
  it("メインアプリと同じ環境変数で上書きし、未設定・不正な値は既定値にする", () => {
    expect(
      resolveStorageLimitBytes({ MEDIA_STORAGE_LIMIT_BYTES: "2048" }),
    ).toBe(2048);
    for (const value of [undefined, "", "abc", "-1", "1.5"]) {
      expect(
        resolveStorageLimitBytes({ MEDIA_STORAGE_LIMIT_BYTES: value }),
      ).toBe(DEFAULT_STORAGE_LIMIT_BYTES);
    }
  });
});
