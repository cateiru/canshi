// 見た目設定（テーマ・コントラスト）。端末ごとの設定として cookie に保存し、
// RootLayout が <html data-theme data-contrast> に出力して src/styles/tokens.css で色を切り替える。

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const CONTRASTS = ["default", "more"] as const;
export type Contrast = (typeof CONTRASTS)[number];

export const DEFAULT_THEME: Theme = "system";
export const DEFAULT_CONTRAST: Contrast = "default";

export const THEME_COOKIE_NAME = "canshi-theme";
export const CONTRAST_COOKIE_NAME = "canshi-contrast";

/** 見た目設定の cookie の保存期間（秒）。ブラウザの上限に合わせて約 400 日とする */
export const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export const THEME_LABEL: Record<Theme, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

export const CONTRAST_LABEL: Record<Contrast, string> = {
  default: "デフォルト",
  more: "上げる",
};

export type Appearance = {
  theme: Theme;
  contrast: Contrast;
};

export function isOneOf<T extends string>(
  values: readonly T[],
  value: string | undefined,
): value is T {
  return values.includes(value as T);
}

/** cookie の値をテーマに変換する。未設定・不正な値はデフォルト（システム）にする */
export function parseTheme(value: string | undefined): Theme {
  return isOneOf(THEMES, value) ? value : DEFAULT_THEME;
}

/** cookie の値をコントラストに変換する。未設定・不正な値はデフォルトにする */
export function parseContrast(value: string | undefined): Contrast {
  return isOneOf(CONTRASTS, value) ? value : DEFAULT_CONTRAST;
}
