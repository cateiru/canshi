import type { CSSProperties } from "react";
import {
  CAT_COAT_FILL_VARIABLE,
  CAT_EAR_FILL_VARIABLE,
  CAT_FEATURE_STROKE_VARIABLE,
  ICON_OUTLINE_STROKE_VARIABLE,
} from "@/components/ui/RecordIcons/RecordIcons";
import type { CatCoatColor } from "@/db/schema";
import styles from "./CatCoatPatternDefs.module.css";
import { CoatArt, darkIconCoatFeatureColor, iconPalette } from "./CoatArt";

/**
 * イラストアイコン（RecordIcons）の猫を、毛色のベース色で塗るための style。この要素の中のアイコンに効く。
 * サビ・ブルークリームのように 2 色が混ざるベース色は、CatCoatPatternDefs と同じ patternId の
 * パターンで斑に塗る。黒系の毛色では目・口を毛色ごとの色にし、耳の内側のピンクを塗らず、
 * ダークテーマではアイコン全体の輪郭をグレーにする。
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
        [CAT_FEATURE_STROKE_VARIABLE]: "initial",
        [CAT_EAR_FILL_VARIABLE]: "initial",
        [ICON_OUTLINE_STROKE_VARIABLE]: "initial",
      } as CSSProperties)
    : undefined;
  if (!coatColor) {
    return reset;
  }
  const palette = iconPalette(coatColor);
  const featureColor = darkIconCoatFeatureColor(coatColor);
  return {
    ...reset,
    [CAT_COAT_FILL_VARIABLE]: palette.patch
      ? `url("#${patternId}") ${palette.fill}`
      : palette.fill,
    ...(featureColor
      ? {
          [CAT_FEATURE_STROKE_VARIABLE]: featureColor,
          [CAT_EAR_FILL_VARIABLE]: "none",
          // ダークテーマでは塗りも背景も濃いため、猫も道具もアイコンの輪郭をグレーにして形を見せる
          [ICON_OUTLINE_STROKE_VARIABLE]:
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
          <CoatArt palette={palette} />
        </pattern>
      </defs>
    </svg>
  );
}
