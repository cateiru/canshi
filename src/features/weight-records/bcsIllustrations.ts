import type { BodyConditionScore } from "./labels";

/**
 * BCS フォームで使うイラストの配置先。
 * 現在は暫定の SVG を置いている。正式なイラストの依頼内容は
 * `docs/illustrations/bcs.md` を参照し、差し替え時はファイルを置いたうえで
 * ここの拡張子（パス）を合わせて変更する
 */
const BCS_ILLUSTRATION_DIR = "/images/bcs";
const BCS_ILLUSTRATION_EXT = "svg";

export type BcsGuideIllustrationKey = "ribs" | "top" | "side";

export function getBcsIllustrationSrc(bcs: BodyConditionScore): string {
  return `${BCS_ILLUSTRATION_DIR}/bcs-${bcs}.${BCS_ILLUSTRATION_EXT}`;
}

export function getBcsGuideIllustrationSrc(
  key: BcsGuideIllustrationKey,
): string {
  return `${BCS_ILLUSTRATION_DIR}/bcs-guide-${key}.${BCS_ILLUSTRATION_EXT}`;
}
