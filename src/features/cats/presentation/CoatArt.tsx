import type { CatCoatColor } from "@/db/schema";

export type CoatPalette = {
  fill: string;
  /** 2 色が混ざる毛色（黒と茶・グレーとクリーム）の、もう 1 色の斑 */
  patch?: string;
};

/** 猫の毛色そのものを表すため、ライト・ダークテーマでは変えない */
const COAT_COLOR_SWATCH: Record<CatCoatColor, CoatPalette> = {
  black: { fill: "#2b2724" },
  brown: { fill: "#9a7650" },
  silver: { fill: "#cfcfcf" },
  red: { fill: "#e09a52" },
  cream: { fill: "#f0dbb4" },
  blue: { fill: "#8f98a5" },
  dark_brown: { fill: "#6b4430" },
  tortoiseshell: {
    fill: "#2b2724",
    patch: "#d47f3a",
  },
  blue_cream: {
    fill: "#8f98a5",
    patch: "#ecd3a6",
  },
  white: { fill: "#f8f6f1" },
};

const UNSET_SWATCH: CoatPalette = {
  fill: "#d8d4cc",
};

/**
 * イラストアイコン（RecordIcons）の猫を塗るときの毛色。
 * アイコンの輪郭・目・口は濃い色（--color-illustration-outline）で描かれ、ダークテーマの背景も濃いため、
 * 濃い毛色は見本より明るくして、顔の輪郭が背景に沈まないようにする
 */
const ICON_COAT_COLOR_OVERRIDE: Partial<Record<CatCoatColor, CoatPalette>> = {
  black: { fill: "#4a4442" },
  dark_brown: { fill: "#7d5640" },
  tortoiseshell: {
    fill: "#4a4442",
    patch: "#d47f3a",
  },
};

/**
 * 黒系の濃い毛色と、そのときのアイコンの猫の目・口の色。輪郭の濃い色では塗りに沈むため、
 * 毛色ごとに見え方を合わせた色で描く。黒系では耳の内側のピンクも浮いて見えるため塗らない
 */
const ICON_DARK_COAT_FEATURE_COLOR: Partial<Record<CatCoatColor, string>> = {
  black: "#bbbbbb",
  dark_brown: "#3c2c2c",
  tortoiseshell: "#ffffff",
};

/**
 * ダークテーマで、その毛色の猫を描くアイコンの輪郭と目・口に使う色（両方を同じ色にする）。
 * ライトテーマでは輪郭は既定の濃い色のままで、目・口は黒系だけ ICON_DARK_COAT_FEATURE_COLOR にする
 */
const ICON_DARK_THEME_LINE_COLOR: Record<CatCoatColor, string> = {
  black: "#0e0e0e",
  brown: "#4e2f03",
  silver: "#656565",
  red: "#7c4912",
  cream: "#8d5417",
  blue: "#515151",
  dark_brown: "#241313",
  tortoiseshell: "#4e3d3d",
  blue_cream: "#525252",
  white: "#585858",
};

/** ダークテーマで、その毛色の猫を描くアイコンの輪郭と目・口に使う色 */
export function darkThemeIconLineColor(coatColor: CatCoatColor): string {
  return ICON_DARK_THEME_LINE_COLOR[coatColor];
}

/** 毛色の見本（CoatSwatch）の色 */
export function swatchPalette(coatColor: CatCoatColor | null): CoatPalette {
  return coatColor ? COAT_COLOR_SWATCH[coatColor] : UNSET_SWATCH;
}

/** イラストアイコンの猫を塗るときの色 */
export function iconPalette(coatColor: CatCoatColor): CoatPalette {
  return ICON_COAT_COLOR_OVERRIDE[coatColor] ?? COAT_COLOR_SWATCH[coatColor];
}

/**
 * 黒系の濃い毛色なら、ライトテーマでのアイコンの猫の目・口の色を返す（耳の内側も塗らない）。それ以外は null
 */
export function darkIconCoatFeatureColor(
  coatColor: CatCoatColor,
): string | null {
  return ICON_DARK_COAT_FEATURE_COLOR[coatColor] ?? null;
}

/**
 * 敷き詰めたときに斑がつながる柄（96×96）。端をまたぐ斑は、反対側の端にも同じ形を描く
 */
const TILED_PATCHES = [
  "M4 20C10 10 22 14 30 8C38 2 46 10 40 20C34 28 26 24 18 32C10 40 0 30 4 20Z",
  "M70 34C76 26 86 32 94 28C102 24 104 40 96 46C88 52 92 62 82 62C72 62 64 42 70 34Z",
  "M30 74C36 66 48 72 54 82C60 92 52 102 42 100C34 98 38 90 28 90C18 90 24 80 30 74Z",
  "M56 6C60 0 72 2 70 10C68 16 62 14 60 20C58 24 52 12 56 6Z",
  "M10 56C14 50 22 54 20 62C18 68 8 64 10 56Z",
  "M48 42C52 38 60 42 58 48C56 54 46 48 48 42Z",
  "M76 78C80 72 90 76 88 84C86 90 74 86 76 78Z",
].join("");

const TILE_OFFSETS = [-96, 0, 96].flatMap((x) =>
  [-96, 0, 96].map((y) => `translate(${x} ${y})`),
);

/** TiledCoatArt の 1 枚の大きさ（viewBox の単位） */
export const TILED_COAT_ART_SIZE = 96;

/**
 * 2 色が混ざる毛色を、敷き詰めてもつなぎ目が出ない 96×96 の正方形に描いた絵。
 * 大きなイラストの猫を、見本（CoatArt）を引き伸ばすより細かい斑で塗るために使う
 */
export function TiledCoatArt({ palette }: { palette: CoatPalette }) {
  return (
    <>
      <path d="M0 0H96V96H0Z" fill={palette.fill} />
      {palette.patch
        ? TILE_OFFSETS.map((transform) => (
            <path
              key={transform}
              d={TILED_PATCHES}
              fill={palette.patch}
              transform={transform}
            />
          ))
        : null}
    </>
  );
}

/**
 * 毛色を 64×64 の正方形に描いた絵。毛色の見本（CoatSwatch）と、
 * イラストアイコンの猫の塗り（CatCoatPatternDefs）で共通に使う
 */
export function CoatArt({ palette }: { palette: CoatPalette }) {
  return (
    <>
      <path d="M0 0H64V64H0Z" fill={palette.fill} />
      {palette.patch ? (
        <path
          d="M0 0H27C34 10 18 15 23 27C27 39 12 43 0 36ZM47 10C56 4 66 13 64 25V55C52 62 43 48 48 38C53 28 36 20 47 10ZM17 52C23 44 37 49 36 59L38 64H11Z"
          fill={palette.patch}
        />
      ) : null}
    </>
  );
}
