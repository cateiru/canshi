import type { SupportedImageMimeType } from "./mimeSniff";

/**
 * 画像のメタデータ（EXIF・XMP・テキストチャンク）をバイト列レベルで除去する。
 * 画質劣化を避けるため画素データは一切再エンコードしない。
 *
 * 位置情報などを落とす一方で、EXIF の Orientation（回転情報）まで消すとスマートフォンで
 * 撮影した写真が横向きに表示されてしまう。そのため Orientation だけを含む最小の EXIF を
 * 再挿入し、表示上の向きを維持する。
 */

/** EXIF Orientation（1〜8）。1 が正位置 */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type SanitizedImage = {
  bytes: Uint8Array;
  orientation: ExifOrientation;
};

const EXIF_ORIENTATION_TAG = 0x0112;
const TIFF_TYPE_SHORT = 3;

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const ICC_PROFILE_ID = "ICC_PROFILE\0";

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let result = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function isExifOrientation(value: number): value is ExifOrientation {
  return Number.isInteger(value) && value >= 1 && value <= 8;
}

/**
 * TIFF 構造（EXIF 本体）から Orientation を読み取る。見つからない・壊れている場合は null
 */
export function parseTiffOrientation(tiff: Uint8Array): ExifOrientation | null {
  if (tiff.length < 8) {
    return null;
  }
  const byteOrder = ascii(tiff, 0, 2);
  if (byteOrder !== "II" && byteOrder !== "MM") {
    return null;
  }
  const littleEndian = byteOrder === "II";
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (view.getUint16(2, littleEndian) !== 0x002a) {
    return null;
  }
  const ifdOffset = view.getUint32(4, littleEndian);
  if (ifdOffset + 2 > tiff.length) {
    return null;
  }
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > tiff.length) {
      return null;
    }
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag !== EXIF_ORIENTATION_TAG) {
      continue;
    }
    const type = view.getUint16(entryOffset + 2, littleEndian);
    if (type !== TIFF_TYPE_SHORT) {
      return null;
    }
    const value = view.getUint16(entryOffset + 8, littleEndian);
    return isExifOrientation(value) ? value : null;
  }
  return null;
}

/**
 * Orientation タグのみを持つ最小の TIFF 構造（26 バイト、リトルエンディアン）を組み立てる
 */
export function buildMinimalExifTiff(orientation: ExifOrientation): Uint8Array {
  const tiff = new Uint8Array(26);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49], 0); // "II"
  view.setUint16(2, 0x002a, true);
  view.setUint32(4, 8, true); // IFD0 offset
  view.setUint16(8, 1, true); // entry count
  view.setUint16(10, EXIF_ORIENTATION_TAG, true);
  view.setUint16(12, TIFF_TYPE_SHORT, true);
  view.setUint32(14, 1, true); // count
  view.setUint16(18, orientation, true); // value（残り 2 バイトは 0 埋め）
  view.setUint32(22, 0, true); // next IFD
  return tiff;
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

const JPEG_SOI = 0xd8;
const JPEG_EOI = 0xd9;
const JPEG_SOS = 0xda;
const JPEG_APP0 = 0xe0;
const JPEG_APP1 = 0xe1;
const JPEG_APP2 = 0xe2;

function isStandaloneMarker(marker: number) {
  // SOI・EOI・RSTn・TEM は長さフィールドを持たない
  return (
    marker === JPEG_SOI ||
    marker === JPEG_EOI ||
    marker === 0x01 ||
    (marker >= 0xd0 && marker <= 0xd7)
  );
}

function buildJpegExifSegment(orientation: ExifOrientation): Uint8Array {
  const tiff = buildMinimalExifTiff(orientation);
  const length = 2 + EXIF_HEADER.length + tiff.length;
  return concat([
    new Uint8Array([0xff, JPEG_APP1, (length >> 8) & 0xff, length & 0xff]),
    new Uint8Array(EXIF_HEADER),
    tiff,
  ]);
}

function sanitizeJpeg(bytes: Uint8Array): SanitizedImage {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== JPEG_SOI) {
    return { bytes, orientation: 1 };
  }

  type Segment = { marker: number; bytes: Uint8Array };
  const segments: Segment[] = [];
  let trailer: Uint8Array = new Uint8Array(0);
  let orientation: ExifOrientation = 1;
  let pos = 2;

  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) {
      // 構造が壊れている。以降は手を付けずそのまま残す
      trailer = bytes.subarray(pos);
      break;
    }
    const marker = bytes[pos + 1];
    if (marker === undefined) {
      trailer = bytes.subarray(pos);
      break;
    }
    if (marker === 0xff) {
      // フィルバイト
      pos += 1;
      continue;
    }
    if (isStandaloneMarker(marker)) {
      segments.push({ marker, bytes: bytes.subarray(pos, pos + 2) });
      pos += 2;
      continue;
    }
    if (marker === JPEG_SOS) {
      // SOS 以降はエントロピー符号化データ。EOI までメタデータは現れないためそのまま残す
      trailer = bytes.subarray(pos);
      break;
    }
    if (pos + 4 > bytes.length) {
      trailer = bytes.subarray(pos);
      break;
    }
    const segmentLength = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const segmentEnd = Math.min(pos + 2 + segmentLength, bytes.length);
    const segment = bytes.subarray(pos, segmentEnd);
    const payload = bytes.subarray(pos + 4, segmentEnd);

    if (marker === JPEG_APP1) {
      const isExif = EXIF_HEADER.every((value, i) => payload[i] === value);
      if (isExif) {
        orientation =
          parseTiffOrientation(payload.subarray(EXIF_HEADER.length)) ?? 1;
      }
      // Exif・XMP・その他の APP1 はすべて除去する
    } else if (marker === JPEG_APP2) {
      // ICC プロファイルは色再現に必要でプライバシー情報を含まないため残す。
      // MPF（マルチピクチャ）など他の APP2 は除去する
      if (ascii(payload, 0, ICC_PROFILE_ID.length) === ICC_PROFILE_ID) {
        segments.push({ marker, bytes: segment });
      }
    } else {
      segments.push({ marker, bytes: segment });
    }
    pos = segmentEnd;
  }

  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  // APP1（Exif）は SOI 直後（JFIF の APP0 がある場合はその直後）に置くのが慣例
  let inserted = orientation === 1;
  for (const segment of segments) {
    if (!inserted && segment.marker !== JPEG_APP0) {
      parts.push(buildJpegExifSegment(orientation));
      inserted = true;
    }
    parts.push(segment.bytes);
  }
  if (!inserted) {
    parts.push(buildJpegExifSegment(orientation));
  }
  parts.push(trailer);

  return { bytes: concat(parts), orientation };
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt"]);

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) {
    return crcTable;
  }
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    typeBytes[i] = type.charCodeAt(i);
  }
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(concat([typeBytes, data])), false);
  return chunk;
}

function sanitizePng(bytes: Uint8Array): SanitizedImage {
  if (
    bytes.length < 8 ||
    !PNG_SIGNATURE.every((value, i) => bytes[i] === value)
  ) {
    return { bytes, orientation: 1 };
  }

  type Chunk = { type: string; bytes: Uint8Array };
  const chunks: Chunk[] = [];
  let orientation: ExifOrientation = 1;
  let pos = 8;
  let trailer: Uint8Array = new Uint8Array(0);

  while (pos + 8 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + pos, 8);
    const length = view.getUint32(0, false);
    const type = ascii(bytes, pos + 4, 4);
    const chunkEnd = Math.min(pos + 12 + length, bytes.length);
    if (PNG_METADATA_CHUNKS.has(type)) {
      if (type === "eXIf") {
        orientation =
          parseTiffOrientation(bytes.subarray(pos + 8, pos + 8 + length)) ?? 1;
      }
    } else {
      chunks.push({ type, bytes: bytes.subarray(pos, chunkEnd) });
    }
    pos = chunkEnd;
    if (type === "IEND") {
      trailer = bytes.subarray(pos);
      break;
    }
  }
  if (pos < bytes.length && trailer.length === 0) {
    trailer = bytes.subarray(pos);
  }

  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const chunk of chunks) {
    parts.push(chunk.bytes);
    // eXIf は IHDR の後・IDAT の前に置く
    if (chunk.type === "IHDR" && orientation !== 1) {
      parts.push(buildPngChunk("eXIf", buildMinimalExifTiff(orientation)));
    }
  }
  parts.push(trailer);

  return { bytes: concat(parts), orientation };
}

// ---------------------------------------------------------------------------
// WebP
// ---------------------------------------------------------------------------

const WEBP_METADATA_CHUNKS = new Set(["EXIF", "XMP "]);
const VP8X_FLAG_EXIF = 0x08;
const VP8X_FLAG_XMP = 0x04;

function buildRiffChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const padded = data.length + (data.length % 2);
  const chunk = new Uint8Array(8 + padded);
  for (let i = 0; i < 4; i++) {
    chunk[i] = fourcc.charCodeAt(i);
  }
  new DataView(chunk.buffer).setUint32(4, data.length, true);
  chunk.set(data, 8);
  return chunk;
}

function sanitizeWebp(bytes: Uint8Array): SanitizedImage {
  if (
    bytes.length < 12 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return { bytes, orientation: 1 };
  }

  type Chunk = { fourcc: string; data: Uint8Array };
  const chunks: Chunk[] = [];
  let orientation: ExifOrientation = 1;
  let pos = 12;

  while (pos + 8 <= bytes.length) {
    const fourcc = ascii(bytes, pos, 4);
    const size = new DataView(
      bytes.buffer,
      bytes.byteOffset + pos + 4,
      4,
    ).getUint32(0, true);
    const dataEnd = Math.min(pos + 8 + size, bytes.length);
    const data = bytes.subarray(pos + 8, dataEnd);
    if (WEBP_METADATA_CHUNKS.has(fourcc)) {
      if (fourcc === "EXIF") {
        // 一部のエンコーダは JPEG と同じ "Exif\0\0" プレフィックスを付ける
        const hasPrefix = EXIF_HEADER.every((value, i) => data[i] === value);
        orientation =
          parseTiffOrientation(
            hasPrefix ? data.subarray(EXIF_HEADER.length) : data,
          ) ?? 1;
      }
    } else {
      chunks.push({ fourcc, data });
    }
    pos = dataEnd + (size % 2);
  }

  const vp8x = chunks.find((chunk) => chunk.fourcc === "VP8X");
  // EXIF チャンクは拡張形式（VP8X）でのみ許されるため、VP8X がない単純形式では再挿入しない
  const reinsertExif = orientation !== 1 && vp8x != null;
  if (vp8x) {
    const flags = new Uint8Array(vp8x.data);
    flags[0] &= ~(VP8X_FLAG_EXIF | VP8X_FLAG_XMP);
    if (reinsertExif) {
      flags[0] |= VP8X_FLAG_EXIF;
    }
    vp8x.data = flags;
  }
  if (reinsertExif) {
    chunks.push({ fourcc: "EXIF", data: buildMinimalExifTiff(orientation) });
  }

  const body = concat(
    chunks.map((chunk) => buildRiffChunk(chunk.fourcc, chunk.data)),
  );
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  new DataView(header.buffer).setUint32(4, 4 + body.length, true);
  header.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"

  return { bytes: concat([header, body]), orientation };
}

// ---------------------------------------------------------------------------

/**
 * 画像からメタデータを除去し、表示に必要な Orientation だけを残す。
 * GIF はメタデータ領域を持たないためそのまま返す。
 */
export function sanitizeImage(
  bytes: Uint8Array,
  mimeType: SupportedImageMimeType,
): SanitizedImage {
  switch (mimeType) {
    case "image/jpeg":
      return sanitizeJpeg(bytes);
    case "image/png":
      return sanitizePng(bytes);
    case "image/webp":
      return sanitizeWebp(bytes);
    case "image/gif":
      return { bytes, orientation: 1 };
    default: {
      const exhaustiveCheck: never = mimeType;
      return exhaustiveCheck;
    }
  }
}
