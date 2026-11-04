// 見た目設定（テーマ・アクセントカラー・コントラスト・文字サイズ）。端末ごとの設定として cookie に保存し、
// RootLayout が <html data-theme data-accent data-contrast data-font-size> に出力して
// src/styles/tokens.css で色と文字サイズを切り替える。

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const ACCENTS = ["orange", "blue", "green", "pink", "purple"] as const;
export type Accent = (typeof ACCENTS)[number];

export const CONTRASTS = ["default", "more"] as const;
export type Contrast = (typeof CONTRASTS)[number];

export const FONT_SIZES = ["small", "medium", "large", "xlarge"] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export const DEFAULT_THEME: Theme = "system";
export const DEFAULT_ACCENT: Accent = "orange";
export const DEFAULT_CONTRAST: Contrast = "default";
export const DEFAULT_FONT_SIZE: FontSize = "medium";

export const THEME_COOKIE_NAME = "canshi-theme";
export const ACCENT_COOKIE_NAME = "canshi-accent";
export const CONTRAST_COOKIE_NAME = "canshi-contrast";
export const FONT_SIZE_COOKIE_NAME = "canshi-font-size";

/** 見た目設定の cookie の保存期間（秒）。ブラウザの上限に合わせて約 400 日とする */
export const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export const THEME_LABEL: Record<Theme, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

export const ACCENT_LABEL: Record<Accent, string> = {
  orange: "オレンジ",
  blue: "ブルー",
  green: "グリーン",
  pink: "ピンク",
  purple: "パープル",
};

export const CONTRAST_LABEL: Record<Contrast, string> = {
  default: "デフォルト",
  more: "上げる",
};

export const FONT_SIZE_LABEL: Record<FontSize, string> = {
  small: "小",
  medium: "中",
  large: "大",
  xlarge: "特大",
};

export type Appearance = {
  theme: Theme;
  accent: Accent;
  contrast: Contrast;
  fontSize: FontSize;
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

/** cookie の値をアクセントカラーに変換する。未設定・不正な値はデフォルト（オレンジ）にする */
export function parseAccent(value: string | undefined): Accent {
  return isOneOf(ACCENTS, value) ? value : DEFAULT_ACCENT;
}

/** cookie の値をコントラストに変換する。未設定・不正な値はデフォルトにする */
export function parseContrast(value: string | undefined): Contrast {
  return isOneOf(CONTRASTS, value) ? value : DEFAULT_CONTRAST;
}

/** cookie の値を文字サイズに変換する。未設定・不正な値はデフォルト（中）にする */
export function parseFontSize(value: string | undefined): FontSize {
  return isOneOf(FONT_SIZES, value) ? value : DEFAULT_FONT_SIZE;
}
