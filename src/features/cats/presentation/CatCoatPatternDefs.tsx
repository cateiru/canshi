import type { CSSProperties } from "react";
import {
  CAT_COAT_FILL_VARIABLE,
  CAT_EAR_FILL_VARIABLE,
  CAT_FEATURE_STROKE_VARIABLE,
  CAT_OUTLINE_STROKE_VARIABLE,
} from "@/components/ui/RecordIcons/RecordIcons";
import type { CatCoatColor } from "@/db/schema";
import styles from "./CatCoatPatternDefs.module.css";
import {
  CoatArt,
  ICON_LIGHT_FEATURE_COLOR,
  iconPalette,
  isDarkIconCoat,
} from "./CoatArt";

/**
 * イラストアイコン（RecordIcons）の猫を、毛色のベース色で塗るための style。この要素の中のアイコンに効く。
 * 柄・白い毛の割合は、小さなアイコンでは線が込み入って見づらくなるため反映しない。
 * サビ・ブルークリームのように 2 色が混ざるベース色は、CatCoatPatternDefs と同じ patternId の
 * パターンで斑に塗る。黒系の毛色では目・口を明るくし、耳の内側のピンクを塗らず、
 * ダークテーマでは輪郭を白くする。
 * ベース色が未設定なら何も設定せず、既定のクリーム色のままにする
 */
export function catCoatIconStyle(
  coatColor: CatCoatColor | null,
  patternId: string,
): CSSProperties | undefined {
  if (!coatColor) {
    return undefined;
  }
  const palette = iconPalette(coatColor);
  return {
    [CAT_COAT_FILL_VARIABLE]: palette.patch
      ? `url("#${patternId}") ${palette.fill}`
      : palette.fill,
    ...(isDarkIconCoat(coatColor)
      ? {
          [CAT_FEATURE_STROKE_VARIABLE]: ICON_LIGHT_FEATURE_COLOR,
          [CAT_EAR_FILL_VARIABLE]: "none",
          // ダークテーマでは塗りも背景も濃いため、輪郭を白くして猫の形を見せる
          [CAT_OUTLINE_STROKE_VARIABLE]:
            "var(--color-illustration-dark-coat-outline)",
        }
      : {}),
  } as CSSProperties;
}

type CatCoatPatternDefsProps = {
  coatColor: CatCoatColor | null;
  /** パターンの id。ページの中で重ならない、CSS の url() にそのまま書ける文字列 */
  patternId: string;
};

/**
 * 2 色が混ざるベース色（サビ・ブルークリーム）でイラストアイコンの猫を塗る SVG パターン。
 * 塗る形（顔・胴・前足）ごとに、その外接矩形いっぱいに毛色の見本と同じ斑を敷く。
 * display: none の SVG の中のパターンは参照できないため、大きさ 0 の見えない SVG に置く
 */
export function CatCoatPatternDefs({
  coatColor,
  patternId,
}: CatCoatPatternDefsProps) {
  if (!coatColor) {
    return null;
  }
  const palette = iconPalette(coatColor);
  if (!palette.patch) {
    return null;
  }

  return (
    <svg className={styles.defs} aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id={patternId}
          patternUnits="objectBoundingBox"
          width="1"
          height="1"
          viewBox="0 0 64 64"
          preserveAspectRatio="xMidYMid slice"
        >
          <CoatArt
            coat={{ coatColor, coatPattern: null, coatWhite: null }}
            palette={palette}
            pointGradientId={`${patternId}-point`}
          />
        </pattern>
      </defs>
    </svg>
  );
}
