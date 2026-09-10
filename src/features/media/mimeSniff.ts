/**
 * 先頭バイト（マジックナンバー）によるメディア形式の判定。
 * ブラウザから送られる `Content-Type` は偽装・誤りがあり得るため信用せず、常にこの判定結果を採用する。
 */

export type MediaKind = "image" | "video";

export type SniffedMediaType =
  | { kind: "image"; mimeType: SupportedImageMimeType }
  | { kind: "video"; mimeType: SupportedVideoMimeType };

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const SUPPORTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type SupportedImageMimeType =
  (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
export type SupportedVideoMimeType =
  (typeof SUPPORTED_VIDEO_MIME_TYPES)[number];
export type SupportedMimeType = SupportedImageMimeType | SupportedVideoMimeType;

/** サムネイルは形式を問わず WebP で保存する */
export const THUMBNAIL_MIME_TYPE = "image/webp";

/** 判定に必要な先頭バイト数。呼び出し側はこの長さだけ読めばよい */
export const SNIFF_HEAD_BYTES = 64;

// ISO BMFF（MP4）の ftyp ボックスで許容するブランド。HEIF／AVIF なども同じ
// コンテナ構造（ftyp）を持つため、既知の動画ブランドに限定して誤判定を防ぐ
const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "mp71",
  "avc1",
  "M4V ",
  "dash",
]);
const QUICKTIME_BRAND = "qt  ";

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let result = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) {
    return false;
  }
  return signature.every((value, i) => bytes[offset + i] === value);
}

function sniffIsoBmff(bytes: Uint8Array): SupportedVideoMimeType | null {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") {
    return null;
  }
  const boxSize = Math.min(
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
    bytes.length,
  );
  const brands = [ascii(bytes, 8, 4)];
  // 互換ブランド（compatible_brands）は 16 バイト目以降に 4 バイトずつ並ぶ
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    brands.push(ascii(bytes, offset, 4));
  }
  if (brands[0] === QUICKTIME_BRAND) {
    return "video/quicktime";
  }
  if (brands.some((brand) => MP4_BRANDS.has(brand))) {
    return "video/mp4";
  }
  if (brands.includes(QUICKTIME_BRAND)) {
    return "video/quicktime";
  }
  return null;
}

function sniffEbml(bytes: Uint8Array): SupportedVideoMimeType | null {
  // EBML ヘッダ。Matroska（.mkv）も同じヘッダを持つため DocType が "webm" のものだけを受け入れる
  if (!startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return null;
  }
  const head = ascii(bytes, 0, Math.min(bytes.length, SNIFF_HEAD_BYTES));
  return head.includes("webm") ? "video/webm" : null;
}

/**
 * 先頭バイトから対応形式を判定する。非対応・判定不能なら null を返す。
 */
export function sniffMediaType(bytes: Uint8Array): SniffedMediaType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg", kind: "image" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", kind: "image" };
  }
  const head6 = ascii(bytes, 0, 6);
  if (head6 === "GIF87a" || head6 === "GIF89a") {
    return { mimeType: "image/gif", kind: "image" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { mimeType: "image/webp", kind: "image" };
  }
  const isoBmff = sniffIsoBmff(bytes);
  if (isoBmff) {
    return { mimeType: isoBmff, kind: "video" };
  }
  const ebml = sniffEbml(bytes);
  if (ebml) {
    return { mimeType: ebml, kind: "video" };
  }
  return null;
}

export function mediaKindOf(mimeType: string): MediaKind {
  return mimeType.startsWith("video/") ? "video" : "image";
}
