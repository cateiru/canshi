/**
 * 共通のごはん商品の画像の検証。画像はブラウザで長辺 `IMAGE_MAX_EDGE` px の JPEG に縮小してから
 * 送る（`views/catalogPages.tsx` のスクリプト）。Workers では画像をデコード・再エンコードしないため、
 * 縮小したものと同じ形（長辺 `IMAGE_MAX_EDGE` px 以下で、位置情報などのメタデータを持たない JPEG）
 * であることをサーバーでも確かめ、スクリプトが動かなかった・縮小が終わる前に送られたなどで
 * 元のまま届いた画像は断る。サムネイルは作らずにそのまま保存する
 */

/** ブラウザで縮小するときの長辺（px） */
export const IMAGE_MAX_EDGE = 800;

/** 受け付ける画像の大きさの上限 */
export const IMAGE_MAX_BYTES = 1024 * 1024;

export type CatalogImageMimeType = "image/jpeg";

export interface JpegInfo {
  width: number;
  height: number;
  /**
   * 撮影情報・位置情報などを含みうるメタデータのセグメント（APP1 の Exif・XMP、APP13 の IPTC）を
   * 持つか。ブラウザの canvas で書き出した JPEG は持たない
   */
  hasMetadata: boolean;
}

/** SOF（フレームの始まり）のマーカー。画像の寸法を持つ。DHT（C4）・JPG（C8）・DAC（CC）は除く */
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const METADATA_MARKERS = new Set([0xe1, 0xed]);
/** 長さを持たない単独のマーカー（TEM・RST0〜7） */
const STANDALONE_MARKERS = new Set([
  0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
]);
const SOS_MARKER = 0xda;

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

/**
 * JPEG のマーカーを画像データ（SOS）の手前までたどり、寸法とメタデータの有無を返す。
 * JPEG でない・壊れているときは null
 */
export function inspectJpeg(bytes: Uint8Array): JpegInfo | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let size: { width: number; height: number } | null = null;
  let hasMetadata = false;
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1];
    // マーカーの前の詰め物の 0xFF は読み飛ばす
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (STANDALONE_MARKERS.has(marker)) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= bytes.length) {
      return null;
    }
    const length = readUint16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) {
      return null;
    }
    if (METADATA_MARKERS.has(marker)) {
      hasMetadata = true;
    }
    if (SOF_MARKERS.has(marker) && length >= 7) {
      size = {
        height: readUint16(bytes, offset + 5),
        width: readUint16(bytes, offset + 7),
      };
    }
    if (marker === SOS_MARKER) {
      return size ? { ...size, hasMetadata } : null;
    }
    offset += 2 + length;
  }
  return null;
}

export type CheckedImage =
  | { ok: true; bytes: Uint8Array; mimeType: CatalogImageMimeType }
  | { ok: false; error: string };

const NOT_RESIZED_ERROR =
  "画像をブラウザで縮小できませんでした。画像を選び直してください（縮小が終わる前に送った場合も、選び直してから送ってください）";

export async function checkCatalogImage(file: File): Promise<CheckedImage> {
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: NOT_RESIZED_ERROR };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectJpeg(bytes);
  if (
    !info ||
    info.hasMetadata ||
    info.width === 0 ||
    info.height === 0 ||
    Math.max(info.width, info.height) > IMAGE_MAX_EDGE
  ) {
    return { ok: false, error: NOT_RESIZED_ERROR };
  }
  return { ok: true, bytes, mimeType: "image/jpeg" };
}
