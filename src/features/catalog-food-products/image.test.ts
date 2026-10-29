// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildMinimalExifTiff, buildPngChunk } from "@/features/media/exif";
import { sniffMediaType } from "@/features/media/mimeSniff";
import {
  createPng,
  type Rgba,
  solidPng,
} from "@/features/media/testing/createPng";
import { decodeImagePixels } from "@/features/media/thumbnail";
import { CATALOG_IMAGE_MAX_EDGE, toCatalogImage } from "./image";

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const TRANSPARENT: Rgba = [0, 0, 0, 0];

/** JPEG の画素を読み、(x, y) の RGB を返す */
function pixelAt(bytes: Uint8Array, x: number, y: number) {
  const { width, pixels } = decodeImagePixels(bytes);
  const offset = (y * width + x) * 4;
  return Array.from(pixels.subarray(offset, offset + 3));
}

/** JPEG は非可逆なので、色はおおよそで比べる */
function expectColor(actual: number[], expected: number[]) {
  for (let index = 0; index < 3; index++) {
    expect(Math.abs(actual[index] - expected[index])).toBeLessThan(40);
  }
}

describe("toCatalogImage", () => {
  it("横長の画像の中央を正方形に切り抜き、一辺の上限まで縮小した JPEG にする", () => {
    // 左右の端だけ赤く、中央の正方形の範囲は青い横長の画像
    const png = createPng(1600, 1000, (x) =>
      x < 300 || x >= 1300 ? RED : BLUE,
    );

    const image = toCatalogImage(png);

    expect(image.size).toBe(CATALOG_IMAGE_MAX_EDGE);
    expect(sniffMediaType(image.bytes)?.mimeType).toBe("image/jpeg");
    const decoded = decodeImagePixels(image.bytes);
    expect([decoded.width, decoded.height]).toEqual([
      CATALOG_IMAGE_MAX_EDGE,
      CATALOG_IMAGE_MAX_EDGE,
    ]);
    expectColor(pixelAt(image.bytes, 0, 400), [0, 0, 255]);
    expectColor(pixelAt(image.bytes, 799, 400), [0, 0, 255]);
  });

  it("縦長の画像も中央を切り抜き、小さい画像は拡大しない", () => {
    const png = createPng(60, 100, (_x, y) => (y < 20 || y >= 80 ? RED : BLUE));

    const image = toCatalogImage(png);

    expect(image.size).toBe(60);
    const decoded = decodeImagePixels(image.bytes);
    expect([decoded.width, decoded.height]).toEqual([60, 60]);
    expectColor(pixelAt(image.bytes, 30, 0), [0, 0, 255]);
    expectColor(pixelAt(image.bytes, 30, 59), [0, 0, 255]);
  });

  it("透明な部分は白にする", () => {
    const png = createPng(64, 64, (x) => (x < 32 ? TRANSPARENT : RED));

    const image = toCatalogImage(png);

    expectColor(pixelAt(image.bytes, 8, 32), [255, 255, 255]);
    expectColor(pixelAt(image.bytes, 56, 32), [255, 0, 0]);
  });

  it("EXIF の Orientation を画素に適用する", () => {
    // 左が赤・右が青。Orientation=6（時計回りに 90 度）で、上が赤・下が青になる
    const png = createPng(64, 64, (x) => (x < 32 ? RED : BLUE), [
      buildPngChunk("eXIf", buildMinimalExifTiff(6)),
    ]);

    const image = toCatalogImage(png);

    expectColor(pixelAt(image.bytes, 32, 8), [255, 0, 0]);
    expectColor(pixelAt(image.bytes, 32, 56), [0, 0, 255]);
  });

  it("画像でない・画素数が多すぎる画像は断る", () => {
    expect(() =>
      toCatalogImage(new TextEncoder().encode("not an image")),
    ).toThrow("対応していない形式です");

    // デコードする前に断るため、寸法だけを持つ PNG で確かめる
    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, 3000, false);
    view.setUint32(4, 2000, false);
    header.set([8, 6, 0, 0, 0], 8);
    const png = solidPng(1, 1, RED);
    const huge = new Uint8Array([
      ...png.subarray(0, 8),
      ...buildPngChunk("IHDR", header),
      ...png.subarray(8 + 25),
    ]);
    expect(() => toCatalogImage(huge)).toThrow("画像が大きすぎます");
  });
});
