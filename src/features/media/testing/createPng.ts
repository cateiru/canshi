import { deflateSync } from "node:zlib";
import { buildPngChunk } from "../exif";

export type Rgba = [number, number, number, number];

/**
 * テスト用に PNG（8bit RGBA、非インターレース）を生成する。
 * 外部の画像ファイルをリポジトリに置かずに、デコード可能なサンプル画像を用意するために使う
 */
export function createPng(
  width: number,
  height: number,
  pixelAt: (x: number, y: number) => Rgba,
  extraChunks: Uint8Array[] = [],
): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw.set([r, g, b, a], rowOffset + 1 + x * 4);
    }
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    buildPngChunk("IHDR", ihdr),
    ...extraChunks,
    buildPngChunk("IDAT", new Uint8Array(deflateSync(raw))),
    buildPngChunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function solidPng(width: number, height: number, color: Rgba) {
  return createPng(width, height, () => color);
}
