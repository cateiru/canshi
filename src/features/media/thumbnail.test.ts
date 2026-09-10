// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sniffMediaType } from "./mimeSniff";
import { createPng, solidPng } from "./testing/createPng";
import {
  calculateThumbnailSize,
  decodeImagePixels,
  generateImageThumbnail,
} from "./thumbnail";

const RED: [number, number, number, number] = [255, 0, 0, 255];
const BLUE: [number, number, number, number] = [0, 0, 255, 255];

describe("calculateThumbnailSize", () => {
  it("長辺を上限に合わせてアスペクト比を保つ", () => {
    expect(calculateThumbnailSize(1024, 768)).toEqual({
      width: 512,
      height: 384,
    });
    expect(calculateThumbnailSize(300, 900)).toEqual({
      width: 171,
      height: 512,
    });
  });

  it("上限以下ならそのままの寸法を返す", () => {
    expect(calculateThumbnailSize(400, 300)).toEqual({
      width: 400,
      height: 300,
    });
    expect(calculateThumbnailSize(512, 512)).toEqual({
      width: 512,
      height: 512,
    });
  });

  it("極端に細長い画像でも 1px 未満にはならない", () => {
    expect(calculateThumbnailSize(10000, 1)).toEqual({ width: 512, height: 1 });
  });
});

describe("generateImageThumbnail", () => {
  it("長辺 512px の WebP を生成し、元画像の寸法を返す", () => {
    const png = solidPng(1024, 256, RED);
    const result = generateImageThumbnail(png);

    expect(result.width).toBe(512);
    expect(result.height).toBe(128);
    expect(result.sourceWidth).toBe(1024);
    expect(result.sourceHeight).toBe(256);
    expect(sniffMediaType(result.bytes)?.mimeType).toBe("image/webp");

    const decoded = decodeImagePixels(result.bytes);
    expect(decoded.width).toBe(512);
    expect(Array.from(decoded.pixels.subarray(0, 3))).toEqual([255, 0, 0]);
  });

  it("小さい画像は拡大しない", () => {
    const result = generateImageThumbnail(solidPng(64, 32, BLUE));
    expect(result.width).toBe(64);
    expect(result.height).toBe(32);
  });

  it("EXIF Orientation=6（時計回りに 90 度）を適用して正位置にする", () => {
    // 横 2px × 縦 1px、左が赤・右が青。90 度時計回りに回すと上が赤・下が青になる
    const png = createPng(2, 1, (x) => (x === 0 ? RED : BLUE));
    const result = generateImageThumbnail(png, 6);

    expect(result.sourceWidth).toBe(1);
    expect(result.sourceHeight).toBe(2);
    const decoded = decodeImagePixels(result.bytes);
    expect(decoded.width).toBe(1);
    expect(decoded.height).toBe(2);
    expect(Array.from(decoded.pixels.subarray(0, 3))).toEqual([255, 0, 0]);
    expect(Array.from(decoded.pixels.subarray(4, 7))).toEqual([0, 0, 255]);
  });

  it("EXIF Orientation=8（反時計回りに 90 度）を適用して正位置にする", () => {
    const png = createPng(2, 1, (x) => (x === 0 ? RED : BLUE));
    const decoded = decodeImagePixels(generateImageThumbnail(png, 8).bytes);
    expect(decoded.width).toBe(1);
    expect(decoded.height).toBe(2);
    expect(Array.from(decoded.pixels.subarray(0, 3))).toEqual([0, 0, 255]);
    expect(Array.from(decoded.pixels.subarray(4, 7))).toEqual([255, 0, 0]);
  });

  it("デコードできないデータは例外を投げる", () => {
    expect(() => generateImageThumbnail(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
