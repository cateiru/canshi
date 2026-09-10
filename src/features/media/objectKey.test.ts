import { describe, expect, it } from "vitest";
import {
  buildObjectKey,
  buildRecordPrefix,
  buildThumbnailObjectKey,
} from "./objectKey";

describe("objectKey", () => {
  it("元データ・サムネイルのキーを生成する", () => {
    expect(buildObjectKey("poop_record", "rec-1", "asset-1")).toBe(
      "poop_record/rec-1/asset-1",
    );
    expect(buildThumbnailObjectKey("poop_record", "rec-1", "asset-1")).toBe(
      "poop_record/rec-1/asset-1.thumb.webp",
    );
    expect(buildRecordPrefix("poop_record", "rec-1")).toBe(
      "poop_record/rec-1/",
    );
  });

  it("スラッシュや空白を含むセグメントは拒否する", () => {
    expect(() => buildObjectKey("poop/record", "rec-1", "asset-1")).toThrow();
    expect(() => buildObjectKey("poop_record", "../x", "asset-1")).toThrow();
    expect(() => buildObjectKey("poop_record", "rec-1", "")).toThrow();
  });
});
