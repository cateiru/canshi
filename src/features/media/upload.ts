import { createImageThumbnail } from "./imageThumbnail";
import { formatBytes, type MediaLimits } from "./limits";
import { createVideoThumbnail } from "./videoThumbnail";
import type { MediaAssetView } from "./view";

/**
 * ブラウザからアップロード API（POST /api/media）を呼ぶクライアント側ヘルパー。
 * サムネイル候補（縮小した画像）をブラウザ側で生成して同時に送る。
 * Workers 側は元画像をデコードせずこの候補から最終サムネイルを作る（メモリ上限対策）
 */

export const MEDIA_UPLOAD_ENDPOINT = "/api/media";

export type UploadMediaInput = {
  file: File;
  recordType: string;
  recordId: string;
};

export type UploadMediaResponse = { asset: MediaAssetView };

export class MediaUploadRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MediaUploadRequestError";
    this.status = status;
  }
}

export function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

export async function uploadMedia({
  file,
  recordType,
  recordId,
}: UploadMediaInput): Promise<MediaAssetView> {
  const formData = new FormData();
  formData.set("recordType", recordType);
  formData.set("recordId", recordId);
  formData.set("file", file);
  if (isVideoFile(file)) {
    // 動画は Workers 側でデコードできないため必須。失敗したらアップロード自体を諦める
    const thumbnail = await createVideoThumbnail(file);
    formData.set("thumbnail", thumbnail.blob, "thumbnail.jpg");
  } else {
    // 画像はブラウザで縮小できなかった場合も送信し、小さい画像なら Workers 側で生成する
    const thumbnail = await createImageThumbnail(file).catch(() => null);
    if (thumbnail) {
      formData.set("thumbnail", thumbnail, "thumbnail");
    }
  }

  const response = await fetch(MEDIA_UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | UploadMediaResponse
    | { error?: string }
    | null;
  if (!response.ok || !payload || !("asset" in payload)) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : "アップロードに失敗しました";
    throw new MediaUploadRequestError(message, response.status);
  }
  return payload.asset;
}

export type FileValidationInput = {
  /** 動画の添付を許可するか */
  allowVideo: boolean;
  limits: MediaLimits;
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|mov)$/i;

/**
 * ファイル選択時にブラウザ側で行う事前チェック。
 * サーバー側でも同じ判定（先頭バイト・上限）を行うため、ここでは利用者に早く知らせるための簡易判定に留める。
 * 問題があればエラーメッセージ、なければ null を返す
 */
export function validateFileForUpload(
  file: File,
  { allowVideo, limits }: FileValidationInput,
): string | null {
  const isVideo = isVideoFile(file) || VIDEO_EXTENSIONS.test(file.name);
  const isImage =
    file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name);
  if (isVideo) {
    if (!allowVideo) {
      return "動画は添付できません";
    }
    if (file.size > limits.maxVideoBytes) {
      return `動画は ${formatBytes(limits.maxVideoBytes)} 以下にしてください`;
    }
    return null;
  }
  if (!isImage) {
    return "対応していない形式です（画像は JPEG／PNG／WebP／GIF）";
  }
  if (file.size > limits.maxImageBytes) {
    return `画像は ${formatBytes(limits.maxImageBytes)} 以下にしてください`;
  }
  return null;
}
