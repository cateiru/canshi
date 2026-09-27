import { describe, expect, it } from "vitest";
import {
  type AffineTransform,
  computeProfileCropDrawing,
  minZoomForRotation,
  rotatedBoundingBox,
} from "./profileCrop";

function apply(t: AffineTransform, x: number, y: number) {
  return { x: t.a * x + t.c * y + t.e, y: t.b * x + t.d * y + t.f };
}

function expectPoint(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe("rotatedBoundingBox", () => {
  it("0 度ではそのまま、90 度では縦横が入れ替わる", () => {
    expect(rotatedBoundingBox(200, 100, 0)).toEqual({
      width: 200,
      height: 100,
    });
    const rotated = rotatedBoundingBox(200, 100, 90);
    expect(rotated.width).toBeCloseTo(100, 6);
    expect(rotated.height).toBeCloseTo(200, 6);
  });

  it("45 度では対角方向に広がる", () => {
    const rotated = rotatedBoundingBox(100, 100, 45);
    expect(rotated.width).toBeCloseTo(100 * Math.SQRT2, 6);
    expect(rotated.height).toBeCloseTo(100 * Math.SQRT2, 6);
  });
});

describe("minZoomForRotation", () => {
  it("回転しなければ 1 倍", () => {
    expect(minZoomForRotation(0)).toBe(1);
  });

  it("45 度では理論値（√2）以上に引き上げる", () => {
    expect(minZoomForRotation(45)).toBeGreaterThan(Math.SQRT2);
  });
});

describe("computeProfileCropDrawing", () => {
  it("回転なしでは切り抜き範囲の左上・右下が出力の四隅に来る", () => {
    const { size, transform } = computeProfileCropDrawing({
      imageWidth: 400,
      imageHeight: 300,
      area: { x: 50, y: 20, width: 200, height: 200 },
      rotation: 0,
    });
    expect(size).toBe(200);
    expectPoint(apply(transform, 50, 20), { x: 0, y: 0 });
    expectPoint(apply(transform, 250, 220), { x: 200, y: 200 });
  });

  it("切り抜き範囲が大きいときは上限サイズに縮小する", () => {
    const { size, transform } = computeProfileCropDrawing({
      imageWidth: 4032,
      imageHeight: 3024,
      area: { x: 0, y: 0, width: 3024, height: 3024 },
      rotation: 0,
      maxSize: 1024,
    });
    expect(size).toBe(1024);
    expectPoint(apply(transform, 3024, 3024), { x: 1024, y: 1024 });
  });

  it("90 度回転では元画像の左上が回転後の右上に来る", () => {
    // 200x100 の画像を 90 度回転するとバウンディングボックスは 100x200
    const { transform } = computeProfileCropDrawing({
      imageWidth: 200,
      imageHeight: 100,
      area: { x: 0, y: 0, width: 100, height: 100 },
      rotation: 90,
    });
    expectPoint(apply(transform, 0, 0), { x: 100, y: 0 });
    // 元画像の左下は回転後の左上
    expectPoint(apply(transform, 0, 100), { x: 0, y: 0 });
  });

  it("回転しても画像の中心はバウンディングボックスの中心に来る", () => {
    const rotation = 30;
    const box = rotatedBoundingBox(400, 300, rotation);
    const area = {
      x: box.width / 2 - 100,
      y: box.height / 2 - 100,
      width: 200,
      height: 200,
    };
    const { transform } = computeProfileCropDrawing({
      imageWidth: 400,
      imageHeight: 300,
      area,
      rotation,
    });
    expectPoint(apply(transform, 200, 150), { x: 100, y: 100 });
  });
});
