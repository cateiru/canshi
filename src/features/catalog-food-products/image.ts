import {
  crop,
  PhotonImage,
  resize,
  SamplingFilter,
} from "@cf-wasm/photon/others";
import { sanitizeImage } from "@/features/media/exif";
import { parseImageDimensions } from "@/features/media/imageDimensions";
import { formatBytes, resolveMediaLimits } from "@/features/media/limits";
import { SNIFF_HEAD_BYTES, sniffMediaType } from "@/features/media/mimeSniff";
import { MediaUploadError } from "@/features/media/storage";
import { applyOrientation, ensurePhoton } from "@/features/media/thumbnail";
import { MAX_DECODE_PIXELS } from "@/features/media/thumbnailSize";

/**
 * AI との接続（MCP）から登録する、共通のごはん商品の画像の加工。管理画面はブラウザで正方形に
 * 切り抜いてから送るが、AI からは大きさ・縦横比の決まっていない画像が届くため、サーバーで
 * 管理画面と同じ形（一辺 `CATALOG_IMAGE_MAX_EDGE` px 以下の正方形で、メタデータを持たない JPEG）にする。
 * 切り抜く位置は、管理画面の切り抜きの初期位置と同じく画像の中央にする
 */

/** 一辺の上限（px）。管理画面の `IMAGE_MAX_EDGE`（`packages/admin/src/catalog/image.ts`）と同じ値 */
export const CATALOG_IMAGE_MAX_EDGE = 800;

/** JPEG の品質。管理画面の切り抜き（`canvas.toBlob` の 0.85）と揃える */
const JPEG_QUALITY = 85;

export type CatalogImage = {
  bytes: Uint8Array;
  /** 一辺の長さ（px） */
  size: number;
};

/** 透明な部分を白で塗る（JPEG は透明を持てず、そのままでは黒くなる）。管理画面の切り抜きと同じ */
function flattenOnWhite(pixels: Uint8Array) {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3];
    if (alpha === 255) {
      continue;
    }
    for (let channel = 0; channel < 3; channel++) {
      pixels[offset + channel] = Math.round(
        (pixels[offset + channel] * alpha + 255 * (255 - alpha)) / 255,
      );
    }
    pixels[offset + 3] = 255;
  }
}

/**
 * 画像の中央を正方形に切り抜き、一辺 `CATALOG_IMAGE_MAX_EDGE` px 以下の JPEG にする（小さい画像は
 * 拡大しない）。EXIF の Orientation は画素に適用する。
 * photon は画像全体を RGBA に展開するため、`MAX_DECODE_PIXELS` を超える画像はデコードせずに断る。
 * 画像でない・読み込めない・大きすぎるときは `MediaUploadError` を投げる
 */
export function toCatalogImage(input: Uint8Array): CatalogImage {
  const sniffed = sniffMediaType(input.subarray(0, SNIFF_HEAD_BYTES));
  if (sniffed?.kind !== "image") {
    throw new MediaUploadError(
      "対応していない形式です（画像は JPEG／PNG／WebP／GIF）",
      415,
    );
  }
  const { maxImageBytes } = resolveMediaLimits();
  if (input.byteLength > maxImageBytes) {
    throw new MediaUploadError(
      `画像は ${formatBytes(maxImageBytes)} 以下にしてください`,
      413,
    );
  }
  const { bytes, orientation } = sanitizeImage(input, sniffed.mimeType);
  const dimensions = parseImageDimensions(bytes, sniffed.mimeType);
  if (!dimensions) {
    throw new MediaUploadError("画像を読み込めませんでした");
  }
  if (dimensions.width * dimensions.height > MAX_DECODE_PIXELS) {
    throw new MediaUploadError(
      `画像が大きすぎます。画素数を ${MAX_DECODE_PIXELS / 1_000_000} 百万画素以下にしてください`,
    );
  }

  ensurePhoton();
  let source: PhotonImage;
  try {
    source = PhotonImage.new_from_byteslice(bytes);
  } catch {
    throw new MediaUploadError("画像を読み込めませんでした");
  }
  // 中央の正方形は向きを変えても中央の正方形のままなので、縮小してから向きを直す
  // （大きい画像のまま回転すると、画素のコピーが増えてメモリを使う）
  const width = source.get_width();
  const height = source.get_height();
  const side = Math.min(width, height);
  const left = Math.floor((width - side) / 2);
  const top = Math.floor((height - side) / 2);
  const cropped = crop(source, left, top, left + side, top + side);
  source.free();

  const size = Math.min(side, CATALOG_IMAGE_MAX_EDGE);
  const resized =
    size === side
      ? cropped
      : resize(cropped, size, size, SamplingFilter.CatmullRom);
  if (resized !== cropped) {
    cropped.free();
  }
  const oriented = applyOrientation(resized, orientation);
  const pixels = oriented.get_raw_pixels();
  oriented.free();

  flattenOnWhite(pixels);
  const output = new PhotonImage(pixels, size, size);
  try {
    return { bytes: output.get_bytes_jpeg(JPEG_QUALITY), size };
  } finally {
    output.free();
  }
}
