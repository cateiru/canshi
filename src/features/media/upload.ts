import { createImageThumbnail } from "./imageThumbnail";
import { formatBytes, type MediaLimits } from "./limits";
import { createVideoThumbnail } from "./videoThumbnail";
import type { MediaAssetView } from "./view";

/**
 * ブラウザからアップロード API（POST /api/media・POST /api/media/uploads）を呼ぶクライアント側ヘルパー。
 * サムネイル候補（縮小した画像）をブラウザ側で生成して同時に送る。
 * Workers 側は元画像をデコードせずこの候補から最終サムネイルを作る（メモリ上限対策）
 */

export const MEDIA_UPLOAD_ENDPOINT = "/api/media";

/** 記録に紐付けない下書きのアップロード先（フォームでファイルを選んだ時点で呼ぶ） */
export const PENDING_MEDIA_UPLOAD_ENDPOINT = "/api/media/uploads";

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

/** 本体と、ブラウザ側で作ったサムネイル候補をフォームに詰める */
async function appendMediaFile(formData: FormData, file: File) {
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
}

function parseUploadResponse(status: number, payload: unknown): MediaAssetView {
  const body = payload as UploadMediaResponse | { error?: string } | null;
  if (status < 200 || status >= 300 || !body || !("asset" in body)) {
    const message =
      body && "error" in body && body.error
        ? body.error
        : "アップロードに失敗しました";
    throw new MediaUploadRequestError(message, status);
  }
  return body.asset;
}

export async function uploadMedia({
  file,
  recordType,
  recordId,
}: UploadMediaInput): Promise<MediaAssetView> {
  const formData = new FormData();
  formData.set("recordType", recordType);
  formData.set("recordId", recordId);
  await appendMediaFile(formData, file);

  const response = await fetch(MEDIA_UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => null);
  return parseUploadResponse(response.status, payload);
}

export type UploadPendingMediaOptions = {
  /** 送信の進捗（0〜1）。サムネイルの作成中は呼ばない */
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

/**
 * 記録に紐付けない下書きとしてアップロードする。
 * 進捗を知るため fetch ではなく XMLHttpRequest（`upload.onprogress`）で送る
 */
export async function uploadPendingMedia(
  file: File,
  { onProgress, signal }: UploadPendingMediaOptions = {},
): Promise<MediaAssetView> {
  const formData = new FormData();
  await appendMediaFile(formData, file);
  signal?.throwIfAborted();

  return new Promise<MediaAssetView>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", PENDING_MEDIA_UPLOAD_ENDPOINT);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      try {
        resolve(parseUploadResponse(xhr.status, xhr.response));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => {
      reject(new MediaUploadRequestError("通信に失敗しました", 0));
    };
    xhr.onabort = () => {
      reject(new DOMException("アップロードを中止しました", "AbortError"));
    };
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(formData);
  });
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
