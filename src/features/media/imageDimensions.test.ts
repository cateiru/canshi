import { describe, expect, it } from "vitest";
import { orientedDimensions, parseImageDimensions } from "./imageDimensions";
import { solidPng } from "./testing/createPng";

function bytesOf(...parts: (number[] | Uint8Array | string)[]) {
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

describe("parseImageDimensions", () => {
  it("JPEG は APP セグメントを読み飛ばして SOF から寸法を得る", () => {
    const jpeg = bytesOf(
      [0xff, 0xd8],
      // APP0（JFIF）: 長さ 16
      [0xff, 0xe0, 0x00, 0x10],
      "JFIF\0",
      [0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00],
      // DQT: 長さ 3（ダミー）
      [0xff, 0xdb, 0x00, 0x03, 0x00],
      // SOF0: 長さ 11、精度 8、高さ 3000、幅 4000、成分 1
      [
        0xff, 0xc0, 0x00, 0x0b, 0x08, 0x0b, 0xb8, 0x0f, 0xa0, 0x01, 0x01, 0x11,
        0x00,
      ],
      [0xff, 0xda],
    );
    expect(parseImageDimensions(jpeg, "image/jpeg")).toEqual({
      width: 4000,
      height: 3000,
    });
  });

  it("JPEG で SOF の前に SOS が来たら null", () => {
    const jpeg = bytesOf([0xff, 0xd8], [0xff, 0xda, 0x00, 0x02]);
    expect(parseImageDimensions(jpeg, "image/jpeg")).toBeNull();
  });

  it("PNG は IHDR から寸法を得る", () => {
    expect(
      parseImageDimensions(solidPng(37, 21, [255, 0, 0, 255]), "image/png"),
    ).toEqual({
      width: 37,
      height: 21,
    });
  });

  it("GIF はロジカルスクリーンの寸法を得る", () => {
    const gif = bytesOf("GIF89a", [0x2c, 0x01, 0x90, 0x00]);
    expect(parseImageDimensions(gif, "image/gif")).toEqual({
      width: 300,
      height: 144,
    });
  });

  it("WebP は VP8・VP8L・VP8X の各形式から寸法を得る", () => {
    const riff = (fourcc: string, payload: number[]) =>
      bytesOf(
        "RIFF",
        [0x00, 0x00, 0x00, 0x00],
        "WEBP",
        fourcc,
        [payload.length, 0x00, 0x00, 0x00],
        payload,
        new Array(Math.max(0, 30 - 20 - payload.length)).fill(0),
      );
    // VP8: フレームタグ(3) + 開始コード + 幅 640・高さ 480（14 ビット）
    expect(
      parseImageDimensions(
        riff(
          "VP8 ",
          [0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a, 0x80, 0x02, 0xe0, 0x01],
        ),
        "image/webp",
      ),
    ).toEqual({ width: 640, height: 480 });
    // VP8L: 幅 1024・高さ 768 → (1023) | (767 << 14)
    const bits = 1023 | (767 << 14);
    expect(
      parseImageDimensions(
        riff("VP8L", [
          0x2f,
          bits & 0xff,
          (bits >>> 8) & 0xff,
          (bits >>> 16) & 0xff,
          (bits >>> 24) & 0xff,
        ]),
        "image/webp",
      ),
    ).toEqual({ width: 1024, height: 768 });
    // VP8X: キャンバス 4032×3024 → 幅-1 = 4031 (0x0fbf)、高さ-1 = 3023 (0x0bcf)
    expect(
      parseImageDimensions(
        riff(
          "VP8X",
          [0x00, 0x00, 0x00, 0x00, 0xbf, 0x0f, 0x00, 0xcf, 0x0b, 0x00],
        ),
        "image/webp",
      ),
    ).toEqual({ width: 4032, height: 3024 });
  });

  it("壊れたデータや短すぎるデータは null", () => {
    expect(parseImageDimensions(new Uint8Array(5), "image/png")).toBeNull();
    expect(parseImageDimensions(new Uint8Array(5), "image/webp")).toBeNull();
    expect(parseImageDimensions(bytesOf("GIF89a"), "image/gif")).toBeNull();
  });
});

describe("orientedDimensions", () => {
  it("Orientation 5〜8 は幅と高さを入れ替える", () => {
    const dims = { width: 4000, height: 3000 };
    expect(orientedDimensions(dims, 1)).toEqual(dims);
    expect(orientedDimensions(dims, 3)).toEqual(dims);
    expect(orientedDimensions(dims, 6)).toEqual({ width: 3000, height: 4000 });
    expect(orientedDimensions(dims, 8)).toEqual({ width: 3000, height: 4000 });
  });
});
