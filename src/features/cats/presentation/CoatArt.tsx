import type { CatCoatColor, CatCoatPattern } from "@/db/schema";
import type { Coat } from "../domain/coat";

export type CoatPalette = {
  fill: string;
  stripe: string;
  patch?: string;
};

/** 猫の毛色そのものを表すため、ライト・ダークテーマでは変えない */
const COAT_COLOR_SWATCH: Record<CatCoatColor, CoatPalette> = {
  black: { fill: "#2b2724", stripe: "#0e0c0b" },
  brown: { fill: "#9a7650", stripe: "#3e2c1c" },
  silver: { fill: "#cfcfcf", stripe: "#4b4b4b" },
  red: { fill: "#e09a52", stripe: "#a3561c" },
  cream: { fill: "#f0dbb4", stripe: "#c99f62" },
  blue: { fill: "#8f98a5", stripe: "#4f5762" },
  dark_brown: { fill: "#6b4430", stripe: "#36200f" },
  tortoiseshell: {
    fill: "#2b2724",
    stripe: "rgba(0, 0, 0, 0.45)",
    patch: "#d47f3a",
  },
  blue_cream: {
    fill: "#8f98a5",
    stripe: "rgba(0, 0, 0, 0.3)",
    patch: "#ecd3a6",
  },
  white: { fill: "#f8f6f1", stripe: "#d9d3c7" },
};

const UNSET_SWATCH: CoatPalette = {
  fill: "#d8d4cc",
  stripe: "#8a857c",
};

/**
 * イラストアイコン（RecordIcons）の猫を塗るときの毛色。
 * アイコンの輪郭・目・口は濃い色（--color-illustration-outline）で描かれ、ダークテーマの背景も濃いため、
 * 濃い毛色は見本より明るくして、顔の輪郭が背景に沈まないようにする
 */
const ICON_COAT_COLOR_OVERRIDE: Partial<Record<CatCoatColor, CoatPalette>> = {
  black: { fill: "#4a4442", stripe: "#1f1b19" },
  dark_brown: { fill: "#7d5640", stripe: "#3e2616" },
  tortoiseshell: {
    fill: "#4a4442",
    stripe: "rgba(0, 0, 0, 0.45)",
    patch: "#d47f3a",
  },
};

/**
 * 黒系の濃い毛色。アイコンの猫の目・口が塗りに沈まないようグレーで描き、
 * 耳の内側のピンクは浮いて見えるため塗らない
 */
const ICON_DARK_COAT_COLORS: ReadonlySet<CatCoatColor> = new Set([
  "black",
  "dark_brown",
  "tortoiseshell",
]);

/**
 * 黒系の毛色のアイコンの猫の目・口の色。輪郭の濃い色では塗りに沈むが、明るくしすぎると
 * 怖く見えるため、塗りより少し明るいグレーにする
 */
export const ICON_DARK_COAT_FEATURE_COLOR = "#595959";

/** 毛色・柄の見本（CoatSwatch）の色 */
export function swatchPalette(coatColor: CatCoatColor | null): CoatPalette {
  return coatColor ? COAT_COLOR_SWATCH[coatColor] : UNSET_SWATCH;
}

/** イラストアイコンの猫を塗るときの色 */
export function iconPalette(coatColor: CatCoatColor): CoatPalette {
  return ICON_COAT_COLOR_OVERRIDE[coatColor] ?? COAT_COLOR_SWATCH[coatColor];
}

/** 黒系の濃い毛色か（アイコンの猫の目・口をグレーにし、耳の内側を塗らない） */
export function isDarkIconCoat(coatColor: CatCoatColor): boolean {
  return ICON_DARK_COAT_COLORS.has(coatColor);
}

/** 32px の見本でも判別できるよう、毛柄の特徴を少ない線・面で描く */
function CoatPatternArt({
  pattern,
  stripe,
  pointGradientId,
}: {
  pattern: CatCoatPattern;
  stripe: string;
  pointGradientId: string;
}) {
  switch (pattern) {
    case "solid":
      return null;
    case "mackerel_tabby":
      return (
        <g fill={stripe}>
          <path d="M5 0H14C10 10 19 19 13 34C15 19 4 14 5 0Z" />
          <path d="M24 0H34C27 13 37 23 29 43C31 24 21 15 24 0Z" />
          <path d="M46 0H55C45 13 55 23 46 34C49 20 39 13 46 0Z" />
          <path d="M5 64H14C20 52 9 45 17 35C4 44 13 53 5 64Z" />
          <path d="M27 64H37C41 52 32 46 39 35C27 43 34 54 27 64Z" />
          <path d="M50 64H59C63 52 53 44 60 32C47 41 56 53 50 64Z" />
        </g>
      );
    case "classic_tabby":
      return (
        <g fill="none" stroke={stripe} strokeLinecap="round">
          <path
            d="M-5 16C10-2 40-5 59 12C76 28 67 54 49 63C27 74 2 59-3 43"
            strokeWidth="7"
          />
          <path
            d="M-4 31C7 15 25 11 41 18C57 25 58 43 46 50C34 57 19 51 17 40C15 30 28 24 36 29C43 34 38 42 31 39"
            strokeWidth="6"
          />
        </g>
      );
    case "spotted":
      return (
        <g fill={stripe}>
          <path d="M10 7C18 4 21 9 18 14C14 20 7 16 7 12C7 10 8 8 10 7Z" />
          <path d="M34 4C40 3 43 8 40 12C36 16 30 12 31 8C31 6 32 5 34 4Z" />
          <path d="M53 14C59 11 64 16 61 22C58 27 51 25 50 20C50 17 51 15 53 14Z" />
          <path d="M26 23C32 20 37 25 34 31C31 37 23 34 23 29C23 26 24 24 26 23Z" />
          <path d="M3 29C9 26 14 30 12 35C11 41 4 43 1 38C-1 34 0 31 3 29Z" />
          <path d="M45 36C51 32 56 37 54 42C52 48 44 49 42 44C41 41 42 38 45 36Z" />
          <path d="M19 45C25 42 29 46 27 52C26 58 18 59 16 53C15 50 16 47 19 45Z" />
          <path d="M39 56C45 53 49 58 46 63C43 68 36 65 36 61C36 59 37 57 39 56Z" />
          <path d="M60 52C65 50 68 55 66 59C63 64 57 61 57 57C57 55 58 53 60 52Z" />
        </g>
      );
    case "ticked":
      // 斑点と区別できるよう、毛先の濃淡を短い流れのある線で表す
      return (
        <g fill="none" stroke={stripe} strokeWidth="2" strokeLinecap="round">
          <path
            d="M8 9L10 5M23 13L25 9M39 7L41 3M52 15L54 11M15 26L17 22M32 23L34 19M46 31L48 27M60 29L62 25M5 43L7 39M24 40L26 36M37 47L39 43M55 47L57 43M14 57L16 53M30 61L32 57M48 62L50 58"
            opacity=".75"
          />
          <path
            d="M3 20L5 16M19 4L21 0M32 36L34 32M43 20L45 16M59 6L61 2M12 39L14 35M23 53L25 49M48 53L50 49M62 58L64 54"
            opacity=".35"
          />
        </g>
      );
    case "colorpoint":
      // 胴は淡く、端に向かって毛色が濃くなる
      return (
        <>
          <defs>
            <radialGradient id={pointGradientId} cx="48%" cy="42%" r="65%">
              <stop offset="25%" stopColor="#f3e9dc" />
              <stop offset="55%" stopColor="#f3e9dc" stopOpacity=".85" />
              <stop offset="100%" stopColor="#f3e9dc" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M0 0H64V64H0Z" fill={`url(#${pointGradientId})`} />
        </>
      );
  }
}

/** 白い毛との境界にも、毛柄に合わせてゆるい起伏を付ける */
const WHITE_PATCH: Record<NonNullable<Coat["coatWhite"]>, string | null> = {
  none: null,
  low: "M0 53C11 58 18 46 31 50S51 58 64 49V64H0Z",
  medium: "M0 34C12 42 22 24 34 31S53 39 64 28V64H0Z",
  high: "M0 14C12 22 22 8 34 14S54 20 64 9V64H0Z",
};

export type CoatArtProps = {
  coat: Coat;
  palette: CoatPalette;
  /** カラーポイントのグラデーションの id。同じページの中で重ならないものを渡す */
  pointGradientId: string;
};

/**
 * 毛色・柄を 64×64 の正方形に描いた絵。毛色・柄の見本（CoatSwatch）と、
 * イラストアイコンの猫の塗り（CatCoatPatternDefs。ベース色だけを渡す）で共通に使う
 */
export function CoatArt({ coat, palette, pointGradientId }: CoatArtProps) {
  const { coatPattern, coatWhite } = coat;
  const whitePatch = coatWhite ? WHITE_PATCH[coatWhite] : null;

  return (
    <>
      <path d="M0 0H64V64H0Z" fill={palette.fill} />
      {palette.patch ? (
        <path
          d="M0 0H27C34 10 18 15 23 27C27 39 12 43 0 36ZM47 10C56 4 66 13 64 25V55C52 62 43 48 48 38C53 28 36 20 47 10ZM17 52C23 44 37 49 36 59L38 64H11Z"
          fill={palette.patch}
        />
      ) : null}
      {coatPattern ? (
        <CoatPatternArt
          pattern={coatPattern}
          stripe={palette.stripe}
          pointGradientId={pointGradientId}
        />
      ) : null}
      {whitePatch ? <path d={whitePatch} fill="#ffffff" /> : null}
    </>
  );
}
