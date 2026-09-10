import type { SupportedImageMimeType } from "./mimeSniff";

/**
 * 画像のヘッダーから寸法を読み取る。画素データはデコードしない。
 * Workers 上で元画像をデコードせずに `width`・`height` を記録し、
 * デコード前に画素数の上限判定を行うために使う
 */

export type ImageDimensions = { width: number; height: number };

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let result = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function u16be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u16le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function u32be(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function u32le(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function valid(width: number, height: number): ImageDimensions | null {
  return width > 0 && height > 0 ? { width, height } : null;
}

/** SOF0〜SOF15 のうち実際にフレームヘッダーであるもの（DHT・JPG・DAC を除く） */
function isJpegSof(marker: number) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function parseJpeg(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) {
      return null;
    }
    const marker = bytes[pos + 1];
    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    // スタンドアロンマーカー（RSTn・TEM）は長さを持たない
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      // SOS・EOI に到達したらフレームヘッダーはもう現れない
      return null;
    }
    const length = u16be(bytes, pos + 2);
    if (isJpegSof(marker)) {
      if (pos + 9 > bytes.length) {
        return null;
      }
      // 長さ(2) 精度(1) 高さ(2) 幅(2)
      return valid(u16be(bytes, pos + 7), u16be(bytes, pos + 5));
    }
    pos += 2 + length;
  }
  return null;
}

function parsePng(bytes: Uint8Array): ImageDimensions | null {
  // シグネチャ(8) + IHDR の長さ(4) + 種別(4) + 幅(4) + 高さ(4)
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") {
    return null;
  }
  return valid(u32be(bytes, 16), u32be(bytes, 20));
}

function parseGif(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 10) {
    return null;
  }
  return valid(u16le(bytes, 6), u16le(bytes, 8));
}

function parseWebp(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30 || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }
  const fourcc = ascii(bytes, 12, 4);
  const payload = 20;
  switch (fourcc) {
    case "VP8 ": {
      // フレームタグ(3) + 開始コード(3) の後に幅・高さ（各 14 ビット）
      if (
        bytes[payload + 3] !== 0x9d ||
        bytes[payload + 4] !== 0x01 ||
        bytes[payload + 5] !== 0x2a
      ) {
        return null;
      }
      return valid(
        u16le(bytes, payload + 6) & 0x3fff,
        u16le(bytes, payload + 8) & 0x3fff,
      );
    }
    case "VP8L": {
      if (bytes[payload] !== 0x2f) {
        return null;
      }
      const bits = u32le(bytes, payload + 1);
      return valid((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    case "VP8X": {
      // フラグ(1) 予約(3) の後にキャンバスの幅-1・高さ-1（各 24 ビット）
      return valid(
        u24le(bytes, payload + 4) + 1,
        u24le(bytes, payload + 7) + 1,
      );
    }
    default:
      return null;
  }
}

/**
 * 対応形式の画像のヘッダーから寸法を読み取る。読み取れない場合は null。
 * 返す寸法は保存された画素の向きのままで、EXIF Orientation は反映しない
 */
export function parseImageDimensions(
  bytes: Uint8Array,
  mimeType: SupportedImageMimeType,
): ImageDimensions | null {
  switch (mimeType) {
    case "image/jpeg":
      return parseJpeg(bytes);
    case "image/png":
      return parsePng(bytes);
    case "image/gif":
      return parseGif(bytes);
    case "image/webp":
      return parseWebp(bytes);
    default: {
      const exhaustiveCheck: never = mimeType;
      return exhaustiveCheck;
    }
  }
}

/**
 * EXIF Orientation を反映した表示上の寸法。5〜8 は 90 度回転を伴うため幅と高さが入れ替わる
 */
export function orientedDimensions(
  dimensions: ImageDimensions,
  orientation: number,
): ImageDimensions {
  return orientation >= 5
    ? { width: dimensions.height, height: dimensions.width }
    : dimensions;
}
