/**
 * プロフィール画像の表示位置・ズーム・回転。
 * x, y は表示の中心を画像のどこに合わせるかを表す、枠のサイズに対する百分率のオフセット
 * （0 が中央、CSS の `translate(x%, y%)` としてそのまま使う）。
 * zoom は 1 以上の拡大倍率、rotation は度数（-180〜180）
 */
export type ProfileCrop = {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
};

export const DEFAULT_PROFILE_CROP: ProfileCrop = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
};

export const MIN_PROFILE_CROP_ZOOM = 1;
export const MAX_PROFILE_CROP_ZOOM = 3;
// ズーム3倍まで許容したときにあり得るオフセットの絶対値に余裕を持たせた上限
const MAX_PROFILE_CROP_OFFSET = 200;

export function clampCropOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PROFILE_CROP.x;
  }
  return Math.min(
    MAX_PROFILE_CROP_OFFSET,
    Math.max(-MAX_PROFILE_CROP_OFFSET, value),
  );
}

export function clampCropZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PROFILE_CROP.zoom;
  }
  return Math.min(
    MAX_PROFILE_CROP_ZOOM,
    Math.max(MIN_PROFILE_CROP_ZOOM, value),
  );
}

export function clampCropRotation(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PROFILE_CROP.rotation;
  }
  return Math.min(180, Math.max(-180, value));
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
