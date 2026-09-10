import { drawToThumbnailCanvas } from "./imageThumbnail";

/**
 * ブラウザ側で動画の先頭フレームを切り出し、サムネイル用の画像 Blob を作る。
 * Workers 上では動画をデコードしないため、動画のアップロード時は元データと一緒にこの画像を送る。
 * 最終的な WebP 化はサーバー側で行うが、Workers のメモリ上限に収まるよう長辺は
 * `CLIENT_THUMBNAIL_MAX_EDGE` まで縮小して JPEG に描画する
 */

export type VideoThumbnail = {
  blob: Blob;
  /** 動画の解像度（縮小前） */
  width: number;
  height: number;
};

// 先頭フレームが真っ黒な動画が多いため、少しだけ進めた位置を使う
const CAPTURE_TIME_SECONDS = 0.1;
const JPEG_QUALITY = 0.9;

export function createVideoThumbnail(file: Blob): Promise<VideoThumbnail> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    video.addEventListener("error", () =>
      fail(
        "動画を読み込めませんでした（ブラウザが対応していない形式の可能性があります）",
      ),
    );
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(
        CAPTURE_TIME_SECONDS,
        Number.isFinite(video.duration) ? video.duration : 0,
      );
    });
    video.addEventListener("seeked", () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width === 0 || height === 0) {
        fail("動画の解像度を取得できませんでした");
        return;
      }
      const canvas = drawToThumbnailCanvas(video, width, height);
      if (!canvas) {
        fail("サムネイルの描画に失敗しました");
        return;
      }
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) {
            reject(new Error("サムネイルの生成に失敗しました"));
            return;
          }
          resolve({ blob, width, height });
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    });

    video.src = objectUrl;
  });
}
