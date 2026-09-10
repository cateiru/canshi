/**
 * ブラウザ側で動画の先頭フレームを切り出し、サムネイル用の画像 Blob を作る。
 * Workers 上では動画をデコードしないため、動画のアップロード時は元データと一緒にこの画像を送る。
 * サムネイルのリサイズ・WebP 化はサーバー側で行うため、ここでは動画の解像度のまま JPEG に描画する
 */

export type VideoThumbnail = {
  blob: Blob;
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
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        fail("サムネイルの描画に失敗しました");
        return;
      }
      context.drawImage(video, 0, 0, width, height);
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
