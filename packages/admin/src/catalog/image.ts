/**
 * 共通のごはん商品の画像の検証。ブラウザで長辺 `IMAGE_MAX_EDGE` px の JPEG に縮小してから
 * 送る（`views/catalogPages.tsx` のスクリプト）ため、サムネイルは作らずにそのまま保存する。
 * スクリプトが動かなかったときの大きな画像は `IMAGE_MAX_BYTES` で断る
 */

/** ブラウザで縮小するときの長辺（px） */
export const IMAGE_MAX_EDGE = 800;

/** 受け付ける画像の大きさの上限 */
export const IMAGE_MAX_BYTES = 1024 * 1024;

export type CatalogImageMimeType = "image/jpeg" | "image/png" | "image/webp";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * 先頭のバイト列から画像の形式を判定する（`Content-Type` やファイル名は信用しない）。
 * メインアプリが家の商品の画像として保存し直せる形式（JPEG・PNG・WebP）だけを受け付ける
 */
export function sniffImageType(bytes: Uint8Array): CatalogImageMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // "RIFF" ....  "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

export type CheckedImage =
  | { ok: true; bytes: Uint8Array; mimeType: CatalogImageMimeType }
  | { ok: false; error: string };

export async function checkCatalogImage(file: File): Promise<CheckedImage> {
  if (file.size > IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error:
        "画像は 1MB 以下にしてください（ブラウザで縮小できなかった可能性があります）",
    };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageType(bytes);
  if (!mimeType) {
    return {
      ok: false,
      error: "画像は JPEG・PNG・WebP のいずれかにしてください",
    };
  }
  return { ok: true, bytes, mimeType };
}
