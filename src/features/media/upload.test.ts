import { describe, expect, it } from "vitest";
import { validateFileForUpload } from "./upload";

const limits = {
  maxImageBytes: 1000,
  maxVideoBytes: 5000,
  storageLimitBytes: 100000,
};

function fileOf(name: string, type: string, size: number) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateFileForUpload", () => {
  it("上限内の画像は許可する", () => {
    expect(
      validateFileForUpload(fileOf("a.jpg", "image/jpeg", 1000), {
        allowVideo: false,
        limits,
      }),
    ).toBeNull();
  });

  it("上限を超える画像・動画はエラーにする", () => {
    expect(
      validateFileForUpload(fileOf("a.jpg", "image/jpeg", 1001), {
        allowVideo: true,
        limits,
      }),
    ).toContain("画像は");
    expect(
      validateFileForUpload(fileOf("a.mp4", "video/mp4", 5001), {
        allowVideo: true,
        limits,
      }),
    ).toContain("動画は");
  });

  it("動画を許可しない場合は MIME タイプ・拡張子のどちらでも拒否する", () => {
    expect(
      validateFileForUpload(fileOf("a.mp4", "video/mp4", 100), {
        allowVideo: false,
        limits,
      }),
    ).toBe("動画は添付できません");
    expect(
      validateFileForUpload(fileOf("a.mov", "", 100), {
        allowVideo: false,
        limits,
      }),
    ).toBe("動画は添付できません");
  });

  it("画像・動画以外は拒否する", () => {
    expect(
      validateFileForUpload(fileOf("a.pdf", "application/pdf", 100), {
        allowVideo: true,
        limits,
      }),
    ).toContain("対応していない形式");
  });
});
