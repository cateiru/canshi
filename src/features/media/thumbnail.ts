import {
  fliph,
  flipv,
  initPhoton,
  PhotonImage,
  resize,
  rotate,
  SamplingFilter,
} from "@cf-wasm/photon/others";
import photonWasm from "@cf-wasm/photon/photon.wasm?module";
import type { ExifOrientation } from "./exif";

/**
 * 画像サムネイルの生成。Workers 上でアップロード時に同期生成する。
 * WASM の画像処理ライブラリ photon を使い、長辺 512px の WebP を出力する。
 *
 * `@cf-wasm/photon` の `workerd` / `node` エントリはそれぞれ静的 .wasm import と
 * 実行時コンパイル（Workers では禁止）に依存し、next dev（Node）・OpenNext（workerd）・
 * Vitest の 3 環境で共通に使えない。そのため `others` エントリに `?module` 付き import で
 * 得た `WebAssembly.Module` を渡して自前で初期化する
 */

export const THUMBNAIL_MAX_EDGE = 512;

export type ThumbnailResult = {
  bytes: Uint8Array;
  /** サムネイルの寸法 */
  width: number;
  height: number;
  /** 回転補正後の元画像の寸法 */
  sourceWidth: number;
  sourceHeight: number;
};

function ensurePhoton() {
  if (!initPhoton.initialized) {
    initPhoton.sync({ module: photonWasm });
  }
}

/**
 * 長辺が maxEdge に収まるよう、アスペクト比を保ったサムネイルの寸法を計算する。
 * 元画像が maxEdge 以下ならそのままの寸法を返す
 */
export function calculateThumbnailSize(
  width: number,
  height: number,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * EXIF Orientation を画素に適用して正位置にする。
 * 戻り値が入力と別インスタンスの場合、入力はこの関数内で解放済み
 */
function applyOrientation(
  image: PhotonImage,
  orientation: ExifOrientation,
): PhotonImage {
  // 各値は「保存された画素を正しく表示するために必要な操作」（EXIF 2.32 の定義）
  switch (orientation) {
    case 1:
      return image;
    case 2:
      fliph(image);
      return image;
    case 3:
      return rotateAndFree(image, 180);
    case 4:
      flipv(image);
      return image;
    case 5:
      fliph(image);
      return rotateAndFree(image, 270);
    case 6:
      return rotateAndFree(image, 90);
    case 7:
      fliph(image);
      return rotateAndFree(image, 90);
    case 8:
      return rotateAndFree(image, 270);
    default: {
      const exhaustiveCheck: never = orientation;
      return exhaustiveCheck;
    }
  }
}

function rotateAndFree(image: PhotonImage, angle: number): PhotonImage {
  const rotated = rotate(image, angle);
  image.free();
  return rotated;
}

/**
 * 画像バイト列（JPEG／PNG／WebP／GIF）からサムネイルを生成する。
 * デコードできないデータの場合は例外を投げる
 */
export function generateImageThumbnail(
  bytes: Uint8Array,
  orientation: ExifOrientation = 1,
): ThumbnailResult {
  ensurePhoton();
  const source = applyOrientation(
    PhotonImage.new_from_byteslice(bytes),
    orientation,
  );
  try {
    const sourceWidth = source.get_width();
    const sourceHeight = source.get_height();
    const target = calculateThumbnailSize(sourceWidth, sourceHeight);
    const needsResize =
      target.width !== sourceWidth || target.height !== sourceHeight;
    const output = needsResize
      ? resize(source, target.width, target.height, SamplingFilter.CatmullRom)
      : source;
    try {
      return {
        bytes: output.get_bytes_webp(),
        width: output.get_width(),
        height: output.get_height(),
        sourceWidth,
        sourceHeight,
      };
    } finally {
      if (output !== source) {
        output.free();
      }
    }
  } finally {
    source.free();
  }
}

/**
 * WebP バイト列を読み込み、画素を RGBA で返す（テスト用）
 */
export function decodeImagePixels(bytes: Uint8Array): {
  width: number;
  height: number;
  pixels: Uint8Array;
} {
  ensurePhoton();
  const image = PhotonImage.new_from_byteslice(bytes);
  try {
    return {
      width: image.get_width(),
      height: image.get_height(),
      pixels: image.get_raw_pixels(),
    };
  } finally {
    image.free();
  }
}
