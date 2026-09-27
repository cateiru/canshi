export const MIN_PROFILE_CROP_ZOOM = 1;
export const MAX_PROFILE_CROP_ZOOM = 3;

/** 切り抜いたプロフィール画像の一辺の最大ピクセル数（サムネイル 512px の 2 倍） */
export const PROFILE_IMAGE_MAX_SIZE = 1024;

export function clampCropRotation(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(180, Math.max(-180, value));
}

/** 回転のスライダーで吸い付かせる角度の間隔 */
export const ROTATION_SNAP_INTERVAL = 45;
/** この角度以内に近づいたら ROTATION_SNAP_INTERVAL の倍数に吸い付かせる */
export const ROTATION_SNAP_THRESHOLD = 5;

/**
 * 回転角度が 45 度の倍数（0・±45・±90…）に近ければ、その角度に吸い付かせる
 */
export function snapRotation(value: number): number {
  const nearest =
    Math.round(value / ROTATION_SNAP_INTERVAL) * ROTATION_SNAP_INTERVAL;
  // -0 を 0 に揃える
  const snapped = nearest === 0 ? 0 : nearest;
  return Math.abs(value - snapped) <= ROTATION_SNAP_THRESHOLD ? snapped : value;
}

/**
 * パン位置が中央のときに回転で四隅がすき間にならないための理論上の最小倍率を
 * 超える分（1 との差）に余裕を持たせる係数。回転 0 度では理論値が常に 1 なので、
 * この係数をかけても最小ズームは 1 のまま変わらない
 */
const ROTATION_ZOOM_SAFETY_MARGIN = 1.3;

/**
 * 指定した角度だけ回転させても正方形の枠の四隅に画像の外側（すき間）が
 * 写り込みにくくなる最小のズーム倍率。react-easy-crop 自身のパン制限（回転後の
 * バウンディングボックス基準の近似）は隅ギリギリまでパンすると理論値ちょうどでは
 * すき間が見えることがあるため、理論値からの超過分に安全率をかけている
 */
export function minZoomForRotation(rotationDeg: number): number {
  const rad = (rotationDeg * Math.PI) / 180;
  const theoreticalMin = Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
  return 1 + (theoreticalMin - 1) * ROTATION_ZOOM_SAFETY_MARGIN;
}

/** react-easy-crop の `croppedAreaPixels`（回転後のバウンディングボックス上の座標） */
export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 画像を回転させたときのバウンディングボックスの寸法 */
export function rotatedBoundingBox(
  width: number,
  height: number,
  rotationDeg: number,
): { width: number; height: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

/**
 * canvas の `setTransform(a, b, c, d, e, f)` に渡す 2 次元アフィン変換
 * （元画像の座標 (x, y) を出力先の (a*x + c*y + e, b*x + d*y + f) に移す）
 */
export type AffineTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type ProfileCropDrawing = {
  /** 出力する正方形の一辺（px） */
  size: number;
  transform: AffineTransform;
};

/**
 * 切り抜き範囲・回転角度から、元画像を出力用の正方形 canvas に描くための変換を求める。
 *
 * 元画像を中心で回転させてバウンディングボックスに収め（react-easy-crop と同じ座標系）、
 * そこから切り抜き範囲を出力サイズに縮小する。元画像の解像度や回転後の大きさの canvas を
 * 作らず出力サイズの canvas に直接描くため、スマートフォンの高解像度写真でも
 * ブラウザの canvas の上限を超えない
 */
export function computeProfileCropDrawing({
  imageWidth,
  imageHeight,
  area,
  rotation,
  maxSize = PROFILE_IMAGE_MAX_SIZE,
}: {
  imageWidth: number;
  imageHeight: number;
  area: CropArea;
  rotation: number;
  maxSize?: number;
}): ProfileCropDrawing {
  const size = Math.max(1, Math.min(maxSize, Math.round(area.width)));
  const scale = size / area.width;
  const box = rotatedBoundingBox(imageWidth, imageHeight, rotation);
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // 画像の中心を原点に移す → 回転 → バウンディングボックスの中心に置く → 切り抜き範囲の左上を原点に → 縮小
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;
  const tx = box.width / 2 - area.x - (cos * cx - sin * cy);
  const ty = box.height / 2 - area.y - (sin * cx + cos * cy);
  return {
    size,
    transform: {
      a: scale * cos,
      b: scale * sin,
      c: -scale * sin,
      d: scale * cos,
      e: scale * tx,
      f: scale * ty,
    },
  };
}
