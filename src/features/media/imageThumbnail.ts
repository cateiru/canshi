import {
  CLIENT_THUMBNAIL_MAX_EDGE,
  calculateThumbnailSize,
} from "./thumbnailSize";

/**
 * ブラウザ側で画像を縮小し、Workers に送るサムネイル候補を作る。
 * Workers（photon）は画像全体を RGBA に展開するため、スマートフォンの高解像度写真を
 * そのまま渡すとメモリ上限（128 MB）を超える。そこで長辺 `CLIENT_THUMBNAIL_MAX_EDGE` まで
 * ブラウザで縮小した画像を元データと一緒に送り、Workers ではこの画像だけをデコードする。
 *
 * `<img>` の描画はブラウザが EXIF Orientation を適用済みなので、出力は正位置になっている
 */

const JPEG_QUALITY = 0.9;

/**
 * 画像・動画フレームをサムネイル候補の寸法に縮小して canvas に描画する。
 * canvas が使えない環境では null
 */
export function drawToThumbnailCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): HTMLCanvasElement | null {
  const target = calculateThumbnailSize(
    sourceWidth,
    sourceHeight,
    CLIENT_THUMBNAIL_MAX_EDGE,
  );
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, target.width, target.height);
  return canvas;
}

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした"));
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("サムネイルの生成に失敗しました")),
      type,
      JPEG_QUALITY,
    );
  });
}

export async function createImageThumbnail(file: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width === 0 || height === 0) {
      throw new Error("画像の寸法を取得できませんでした");
    }
    const canvas = drawToThumbnailCanvas(image, width, height);
    if (!canvas) {
      throw new Error("サムネイルの描画に失敗しました");
    }
    // 透過を持ちうる形式は PNG のまま送る（JPEG にすると透過部分が黒くなる）
    const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    return await canvasToBlob(canvas, type);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
