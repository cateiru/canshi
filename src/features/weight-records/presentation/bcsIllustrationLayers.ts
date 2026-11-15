// このファイルは scripts/split-bcs-illustrations.mjs が生成する。手で編集しない。

export type BcsIllustrationLayers = {
  width: number;
  height: number;
  /** 白い手・オレンジの点線など、元の色のまま重ねる画像があるか */
  hasOverlay: boolean;
};

export const BCS_ILLUSTRATION_LAYERS = {
  "bcs-1": { width: 840, height: 840, hasOverlay: false },
  "bcs-2": { width: 840, height: 840, hasOverlay: false },
  "bcs-3": { width: 840, height: 840, hasOverlay: false },
  "bcs-4": { width: 840, height: 840, hasOverlay: false },
  "bcs-5": { width: 840, height: 840, hasOverlay: false },
  "bcs-guide-ribs": { width: 840, height: 512, hasOverlay: true },
  "bcs-guide-top": { width: 840, height: 512, hasOverlay: true },
  "bcs-guide-side": { width: 840, height: 512, hasOverlay: true },
} as const satisfies Record<string, BcsIllustrationLayers>;

export type BcsIllustrationName = keyof typeof BCS_ILLUSTRATION_LAYERS;
