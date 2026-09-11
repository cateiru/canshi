/**
 * プロフィール画像の表示位置。CSS の object-position と同じ意味の 0〜100 の百分率
 */
export type ProfileCrop = { x: number; y: number };

export const DEFAULT_PROFILE_CROP: ProfileCrop = { x: 50, y: 50 };

export function clampCropPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PROFILE_CROP.x;
  }
  return Math.min(100, Math.max(0, value));
}
