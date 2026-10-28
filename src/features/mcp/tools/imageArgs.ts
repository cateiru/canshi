import { DEFAULT_MEDIA_LIMITS } from "@/features/media/limits";
import { SNIFF_HEAD_BYTES, sniffMediaType } from "@/features/media/mimeSniff";

/*
 * ツールの引数で受け取る画像（base64）。ごはん商品・共通のごはん商品のツールで使う
 */

/** base64 の文字数の上限。画像の上限（既定 10MB）を base64 にした長さ */
export const MAX_IMAGE_BASE64_LENGTH =
  Math.ceil(DEFAULT_MEDIA_LIMITS.maxImageBytes / 3) * 4 + 100;

export const INVALID_IMAGE_ERROR =
  "image が画像（JPEG・PNG・WebP・GIF）の base64 ではありません";

/** base64（data URL の形式も可）の画像を読む。画像でなければ null */
export function decodeImageBase64(
  value: string,
): Uint8Array<ArrayBuffer> | null {
  const base64 = value.replace(/^data:[^,]*;base64,/, "").replace(/\s/g, "");
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (sniffMediaType(bytes.subarray(0, SNIFF_HEAD_BYTES))?.kind !== "image") {
    return null;
  }
  return bytes;
}
