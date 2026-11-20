import {
  CAT_COAT_FILL_VARIABLE,
  CAT_COAT_TILED_FILL_VARIABLE,
  CAT_EAR_FILL_VARIABLE,
} from "@canshi/shared/ui/RecordIcons";
import type { CSSProperties } from "react";
import type { CatCoatColor } from "@/db/schema";
import styles from "./CatCoatPatternDefs.module.css";
import {
  CoatArt,
  darkIconCoatFeatureColor,
  darkThemeIconLineColor,
  iconPalette,
  largeIllustrationLightLineColor,
  TILED_COAT_ART_SIZE,
  TiledCoatArt,
} from "./CoatArt";

/**
 * 目・口・輪郭の色は、ライト・ダークテーマで変えるため、style では元になる値だけを渡し、
 * CAT_COAT_ICON_SCOPE_CLASS（CatCoatPatternDefs.module.css）でテーマに合わせて
 * RecordIcons の変数（--illustration-cat-feature・--illustration-outline・--illustration-cat-line）に振り分ける
 */
const LIGHT_FEATURE_VARIABLE = "--cat-coat-light-feature";
const LIGHT_LINE_VARIABLE = "--cat-coat-light-line";
const DARK_LINE_VARIABLE = "--cat-coat-dark-line";

/**
 * 大きなイラスト用の、斑を敷き詰めたパターンの 1 枚の大きさ。パターンを使う SVG の座標の単位で、
 * 幅 840 の BCS のイラストで猫 1 匹に斑が 10 個前後並ぶ大きさにしている
 */
const TILED_PATTERN_SIZE = 280;

/** 大きなイラスト用の、斑を敷き詰めたパターンの id */
function tiledPatternId(patternId: string): string {
  return `${patternId}-tiled`;
}

/** catCoatIconStyle の style と一緒に付ける class。テーマに合わせて目・口・輪郭の色を選ぶ */
export const CAT_COAT_ICON_SCOPE_CLASS = styles.coatScope;

/**
 * イラストアイコン（RecordIcons）の猫を、毛色のベース色で塗るための style。この要素の中のアイコンに効く。
 * サビ・ブルークリームのように 2 色が混ざるベース色は、CatCoatPatternDefs と同じ patternId の
 * パターンで斑に塗る（大きなイラスト用に、斑を敷き詰めたパターンの変数も設定する）。黒系の毛色では耳の内側のピンクを塗らず、ライトテーマでは目・口を毛色ごとの色にする。
 * ダークテーマでは、アイコン全体の輪郭と目・口を毛色ごとの同じ色にする。
 * 大きなイラスト（BCS）の輪郭は、黒系の毛色ではライトテーマでも明るくする。
 * 要素には CAT_COAT_ICON_SCOPE_CLASS も付ける。
 * ベース色が未設定なら何も設定せず、既定のクリーム色のままにする。
 * `isolate` を付けると、祖先で別の猫の毛色が設定されていても受け継がず、設定しない変数は既定に戻す
 * （猫の編集ページで、保存済みの毛色の中に選んでいる毛色のプレビューを置くときなど）
 */
export function catCoatIconStyle(
  coatColor: CatCoatColor | null,
  patternId: string,
  { isolate = false }: { isolate?: boolean } = {},
): CSSProperties | undefined {
  // initial にした変数は未設定と同じ扱いになり、各アイコンの既定の色に戻る
  const reset: CSSProperties | undefined = isolate
    ? ({
        [CAT_COAT_FILL_VARIABLE]: "initial",
        [CAT_COAT_TILED_FILL_VARIABLE]: "initial",
        [CAT_EAR_FILL_VARIABLE]: "initial",
        [LIGHT_FEATURE_VARIABLE]: "initial",
        [LIGHT_LINE_VARIABLE]: "initial",
        [DARK_LINE_VARIABLE]: "initial",
      } as CSSProperties)
    : undefined;
  if (!coatColor) {
    return reset;
  }
  const palette = iconPalette(coatColor);
  const featureColor = darkIconCoatFeatureColor(coatColor);
  const largeLightLineColor = largeIllustrationLightLineColor(coatColor);
  return {
    ...reset,
    [CAT_COAT_FILL_VARIABLE]: palette.patch
      ? `url("#${patternId}") ${palette.fill}`
      : palette.fill,
    ...(palette.patch
      ? {
          [CAT_COAT_TILED_FILL_VARIABLE]: `url("#${tiledPatternId(patternId)}") ${palette.fill}`,
        }
      : {}),
    [DARK_LINE_VARIABLE]: darkThemeIconLineColor(coatColor),
    ...(largeLightLineColor
      ? { [LIGHT_LINE_VARIABLE]: largeLightLineColor }
      : {}),
    ...(featureColor
      ? {
          [LIGHT_FEATURE_VARIABLE]: featureColor,
          [CAT_EAR_FILL_VARIABLE]: "none",
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
 * 大きなイラスト用に、小さな斑を敷き詰めたパターン（`<patternId>-tiled`）も置く。
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
          <CoatArt palette={palette} />
        </pattern>
        <pattern
          id={tiledPatternId(patternId)}
          patternUnits="userSpaceOnUse"
          width={TILED_PATTERN_SIZE}
          height={TILED_PATTERN_SIZE}
          viewBox={`0 0 ${TILED_COAT_ART_SIZE} ${TILED_COAT_ART_SIZE}`}
        >
          <TiledCoatArt palette={palette} />
        </pattern>
      </defs>
    </svg>
  );
}
