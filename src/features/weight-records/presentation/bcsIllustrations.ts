import type { BodyConditionScore } from "../domain/labels";
import type { BcsIllustrationName } from "./bcsIllustrationLayers";

/**
 * BCS フォームで使うイラストの配置先。
 * イラストは毛色で塗り替えられるよう、塗り・輪郭・重ねる画像の層に分けて置く
 * （`scripts/split-bcs-illustrations.mjs` で生成）。
 * イラストの仕様と差し替え手順は `docs/illustrations/bcs.md` を参照。
 */
const BCS_ILLUSTRATION_DIR = "/images/bcs";

export type BcsGuideIllustrationKey = "ribs" | "top" | "side";

/** 層の画像。fill・line はアルファのマスク、overlay は元の色のまま重ねる画像 */
export type BcsIllustrationLayer = "fill" | "line" | "overlay";

export function getBcsIllustrationName(
  bcs: BodyConditionScore,
): BcsIllustrationName {
  return `bcs-${bcs}`;
}

export function getBcsGuideIllustrationName(
  key: BcsGuideIllustrationKey,
): BcsIllustrationName {
  return `bcs-guide-${key}`;
}

export function getBcsIllustrationLayerSrc(
  name: BcsIllustrationName,
  layer: BcsIllustrationLayer,
): string {
  return `${BCS_ILLUSTRATION_DIR}/${name}-${layer}.png`;
}
