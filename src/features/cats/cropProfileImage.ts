import { type CropArea, computeProfileCropDrawing } from "./profileCrop";

const JPEG_QUALITY = 0.9;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした"));
    image.src = url;
  });
}

/**
 * ブラウザ側で画像を正方形に切り抜き、アップロード用の JPEG ファイルにする。
 * `<img>` の描画はブラウザが EXIF Orientation を適用済みのため、react-easy-crop の表示と
 * 同じ向きで切り抜かれる。透過部分は白で塗る（JPEG にすると黒くなるため）
 */
export async function cropProfileImage(
  imageUrl: string,
  area: CropArea,
  rotation: number,
): Promise<File> {
  const image = await loadImage(imageUrl);
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("画像の寸法を取得できませんでした");
  }
  const { size, transform } = computeProfileCropDrawing({
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    area,
    rotation,
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("画像の切り抜きに失敗しました");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  );
  context.drawImage(image, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("画像の切り抜きに失敗しました")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  return new File([blob], "profile.jpg", { type: "image/jpeg" });
}
