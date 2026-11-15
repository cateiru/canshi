// このファイルは scripts/split-bcs-illustrations.mjs が生成する。手で編集しない。

export type BcsIllustrationRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BcsIllustrationLayers = {
  width: number;
  height: number;
  /** 白い手・オレンジの点線など、元の色のまま重ねる画像があるか */
  hasOverlay: boolean;
  /** 猫ごとの塗りの外接矩形。毛色の斑（SVG パターン）を猫ごとに敷くために分ける */
  regions: BcsIllustrationRegion[];
};

/** 元の画像の塗りの色。毛色が未設定のときに使う */
export const BCS_ILLUSTRATION_DEFAULT_FILL = "#f9cca2";

export const BCS_ILLUSTRATION_LAYERS = {
  "bcs-1": {
    width: 840,
    height: 840,
    hasOverlay: false,
    regions: [
      { x: 50, y: 119, width: 773, height: 179 },
      { x: 53, y: 322, width: 761, height: 457 },
    ],
  },
  "bcs-2": {
    width: 840,
    height: 840,
    hasOverlay: false,
    regions: [
      { x: 55, y: 117, width: 776, height: 184 },
      { x: 56, y: 316, width: 762, height: 465 },
    ],
  },
  "bcs-3": {
    width: 840,
    height: 840,
    hasOverlay: false,
    regions: [
      { x: 55, y: 116, width: 775, height: 186 },
      { x: 56, y: 318, width: 760, height: 464 },
    ],
  },
  "bcs-4": {
    width: 840,
    height: 840,
    hasOverlay: false,
    regions: [
      { x: 55, y: 116, width: 775, height: 184 },
      { x: 54, y: 323, width: 764, height: 459 },
    ],
  },
  "bcs-5": {
    width: 840,
    height: 840,
    hasOverlay: false,
    regions: [
      { x: 55, y: 114, width: 775, height: 201 },
      { x: 55, y: 330, width: 769, height: 452 },
    ],
  },
  "bcs-guide-ribs": {
    width: 840,
    height: 512,
    hasOverlay: true,
    regions: [{ x: 53, y: 152, width: 762, height: 229 }],
  },
  "bcs-guide-top": {
    width: 840,
    height: 512,
    hasOverlay: true,
    regions: [{ x: 55, y: 165, width: 759, height: 179 }],
  },
  "bcs-guide-side": {
    width: 840,
    height: 512,
    hasOverlay: true,
    regions: [{ x: 61, y: 51, width: 746, height: 433 }],
  },
} as const satisfies Record<string, BcsIllustrationLayers>;

export type BcsIllustrationName = keyof typeof BCS_ILLUSTRATION_LAYERS;
