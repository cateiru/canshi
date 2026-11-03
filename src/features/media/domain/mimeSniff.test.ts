import { describe, expect, it } from "vitest";
import { mediaKindOf, sniffMediaType } from "./mimeSniff";

function bytesOf(...parts: (string | number[])[]): Uint8Array {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      for (const char of part) {
        out.push(char.charCodeAt(0));
      }
    } else {
      out.push(...part);
    }
  }
  return new Uint8Array(out);
}

function ftyp(majorBrand: string, compatible: string[] = []): Uint8Array {
  const size = 16 + compatible.length * 4;
  return bytesOf(
    [0, 0, 0, size],
    "ftyp",
    majorBrand,
    [0, 0, 0, 0],
    ...compatible,
  );
}

describe("sniffMediaType", () => {
  it("JPEG を判定する", () => {
    expect(sniffMediaType(bytesOf([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      mimeType: "image/jpeg",
      kind: "image",
    });
  });

  it("PNG を判定する", () => {
    expect(
      sniffMediaType(bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toEqual({ mimeType: "image/png", kind: "image" });
  });

  it("GIF を判定する", () => {
    expect(sniffMediaType(bytesOf("GIF89a"))).toEqual({
      mimeType: "image/gif",
      kind: "image",
    });
    expect(sniffMediaType(bytesOf("GIF87a"))).toEqual({
      mimeType: "image/gif",
      kind: "image",
    });
  });

  it("WebP を判定する", () => {
    expect(sniffMediaType(bytesOf("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toEqual({
      mimeType: "image/webp",
      kind: "image",
    });
  });

  it("MP4 を主要ブランド・互換ブランドの両方から判定する", () => {
    expect(sniffMediaType(ftyp("isom", ["iso2", "mp41"]))).toEqual({
      mimeType: "video/mp4",
      kind: "video",
    });
    expect(sniffMediaType(ftyp("XXXX", ["avc1"]))).toEqual({
      mimeType: "video/mp4",
      kind: "video",
    });
  });

  it("QuickTime を判定する", () => {
    expect(sniffMediaType(ftyp("qt  "))).toEqual({
      mimeType: "video/quicktime",
      kind: "video",
    });
  });

  it("HEIF／AVIF は ftyp を持つが非対応として扱う", () => {
    expect(sniffMediaType(ftyp("heic", ["mif1"]))).toBeNull();
    expect(sniffMediaType(ftyp("avif", ["mif1"]))).toBeNull();
  });

  it("WebM を判定し、Matroska は非対応として扱う", () => {
    expect(
      sniffMediaType(
        bytesOf(
          [0x1a, 0x45, 0xdf, 0xa3],
          [0x9f, 0x42, 0x86, 0x81, 0x01],
          [0x42, 0x82, 0x84],
          "webm",
        ),
      ),
    ).toEqual({ mimeType: "video/webm", kind: "video" });
    expect(
      sniffMediaType(
        bytesOf([0x1a, 0x45, 0xdf, 0xa3], [0x42, 0x82, 0x88], "matroska"),
      ),
    ).toBeNull();
  });

  it("非対応形式・空データは null を返す", () => {
    expect(sniffMediaType(bytesOf("%PDF-1.7"))).toBeNull();
    expect(sniffMediaType(new Uint8Array(0))).toBeNull();
    expect(sniffMediaType(bytesOf([0xff, 0xd8]))).toBeNull();
  });
});

describe("mediaKindOf", () => {
  it("MIME タイプから画像・動画を判定する", () => {
    expect(mediaKindOf("image/jpeg")).toBe("image");
    expect(mediaKindOf("video/mp4")).toBe("video");
  });
});
