import type { BodyConditionScore } from "./labels";

/**
 * BCS フォームで使うイラストの配置先。
 * イラストの仕様と差し替え手順は `docs/illustrations/bcs.md` を参照。
 */
const BCS_ILLUSTRATION_DIR = "/images/bcs";
const BCS_ILLUSTRATION_EXT = "png";

export type BcsGuideIllustrationKey = "ribs" | "top" | "side";

export function getBcsIllustrationSrc(bcs: BodyConditionScore): string {
  return `${BCS_ILLUSTRATION_DIR}/bcs-${bcs}.${BCS_ILLUSTRATION_EXT}`;
}

export function getBcsGuideIllustrationSrc(
  key: BcsGuideIllustrationKey,
): string {
  return `${BCS_ILLUSTRATION_DIR}/bcs-guide-${key}.${BCS_ILLUSTRATION_EXT}`;
}
