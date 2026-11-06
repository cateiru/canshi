import type { CSSProperties } from "react";
import type { CatCoatColor, CatCoatPattern } from "@/db/schema";
import type { Coat } from "../domain/coat";
import styles from "./CoatSwatch.module.css";

/**
 * ベース色ごとの見本の色。`fill` は地の色（サビ・三毛のような 2 色の毛色は斑の模様）、
 * `stripe` は柄の色。猫の毛の色そのものを表すため、見た目設定（ライト・ダーク）では変えない
 */
const COAT_COLOR_SWATCH: Record<
  CatCoatColor,
  { fill: string; stripe: string }
> = {
  black: { fill: "#2b2724", stripe: "#0e0c0b" },
  brown: { fill: "#9a7650", stripe: "#3e2c1c" },
  silver: { fill: "#cfcfcf", stripe: "#4b4b4b" },
  red: { fill: "#e09a52", stripe: "#a3561c" },
  cream: { fill: "#f0dbb4", stripe: "#c99f62" },
  blue: { fill: "#8f98a5", stripe: "#4f5762" },
  dark_brown: { fill: "#6b4430", stripe: "#36200f" },
  tortoiseshell: {
    fill: patches("#2b2724", "#d47f3a"),
    stripe: "rgba(0, 0, 0, 0.45)",
  },
  blue_cream: {
    fill: patches("#8f98a5", "#ecd3a6"),
    stripe: "rgba(0, 0, 0, 0.3)",
  },
  white: { fill: "#f8f6f1", stripe: "#d9d3c7" },
};

/** ベース色が未設定のときの見本の色 */
const UNSET_SWATCH = { fill: "#d8d4cc", stripe: "#8a857c" };

/** 2 色が斑に混ざった地の模様 */
function patches(first: string, second: string): string {
  return `conic-gradient(from 20deg at 45% 55%, ${first} 0 80deg, ${second} 80deg 150deg, ${first} 150deg 230deg, ${second} 230deg 290deg, ${first} 290deg)`;
}

type Layer = { image: string; size?: string };

function patternLayers(pattern: CatCoatPattern, stripe: string): Layer[] {
  switch (pattern) {
    case "solid":
      return [];
    case "mackerel_tabby":
      return [
        {
          image: `repeating-linear-gradient(80deg, ${stripe} 0 7%, transparent 7% 18%)`,
        },
      ];
    case "classic_tabby":
      return [
        {
          image: `repeating-radial-gradient(circle at 70% 45%, ${stripe} 0 7%, transparent 7% 18%)`,
        },
      ];
    case "spotted":
      return [
        {
          image: `radial-gradient(circle, ${stripe} 0 28%, transparent 31%)`,
          size: "34% 34%",
        },
      ];
    case "ticked":
      return [
        {
          image: `radial-gradient(circle, ${stripe} 0 22%, transparent 26%)`,
          size: "16% 16%",
        },
      ];
    case "colorpoint":
      // 体は淡く、顔・耳・手足などの端だけがベース色になる
      return [
        {
          image:
            "radial-gradient(circle at 50% 42%, #f3e9dc 0 34%, transparent 72%)",
        },
      ];
  }
}

/** 白い毛が占める高さ（下からの割合） */
const WHITE_HEIGHT: Record<NonNullable<Coat["coatWhite"]>, number> = {
  none: 0,
  low: 22,
  medium: 50,
  high: 78,
};

export type CoatSwatchProps = {
  coat: Coat;
  /**
   * - sm: 選択肢に添える小さな見本
   * - md: ベース色の選択肢（色見本だけで選ぶ）
   * - lg: 選んだ毛色・柄の見本
   */
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * 毛色・柄（ベース色・柄・白い毛の割合）を丸い見本で表す。装飾のため読み上げない
 * （毛色・柄の名前は、見本の隣に文字で示す）
 */
export function CoatSwatch({ coat, size = "sm", className }: CoatSwatchProps) {
  const classes = [styles.swatch, styles[size], className]
    .filter(Boolean)
    .join(" ");
  const { coatColor, coatPattern, coatWhite } = coat;

  if (!coatColor && !coatPattern && !coatWhite) {
    return <span className={`${classes} ${styles.empty}`} aria-hidden="true" />;
  }

  const { fill, stripe } = coatColor
    ? COAT_COLOR_SWATCH[coatColor]
    : UNSET_SWATCH;
  const whiteHeight = coatWhite ? WHITE_HEIGHT[coatWhite] : 0;
  // 上に重ねるものから順に並べる（白い毛 → 柄 → 地の色）
  const layers: Layer[] = [
    ...(whiteHeight > 0
      ? [
          {
            image: `linear-gradient(to top, #ffffff 0 ${whiteHeight}%, transparent ${whiteHeight}%)`,
          },
        ]
      : []),
    ...(coatPattern ? patternLayers(coatPattern, stripe) : []),
    {
      image: fill.includes("gradient")
        ? fill
        : `linear-gradient(${fill}, ${fill})`,
    },
  ];
  const style: CSSProperties = {
    backgroundImage: layers.map((layer) => layer.image).join(", "),
    backgroundSize: layers.map((layer) => layer.size ?? "100% 100%").join(", "),
  };

  return <span className={classes} style={style} aria-hidden="true" />;
}
