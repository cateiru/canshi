import { type CSSProperties, useId } from "react";
import {
  CAT_COAT_FILL_VARIABLE,
  CAT_COAT_TILED_FILL_VARIABLE,
  CAT_LINE_VARIABLE,
  DEFAULT_CAT_COAT,
  ICON_OUTLINE_STROKE_VARIABLE,
} from "@/components/ui/RecordIcons/RecordIcons";
import {
  BCS_ILLUSTRATION_LAYERS,
  type BcsIllustrationName,
} from "./bcsIllustrationLayers";
import { getBcsIllustrationLayerSrc } from "./bcsIllustrations";

/**
 * 猫の塗り。イラストアイコン（RecordIcons）と同じく、猫のページでは毛色で塗る。
 * サビ・ブルークリームは、アイコンの斑を引き伸ばすと大きすぎるため、小さな斑を敷き詰めた
 * パターンで塗る。未設定ならアイコンと同じクリーム色
 */
const fillStyle: CSSProperties = {
  fill: `var(${CAT_COAT_TILED_FILL_VARIABLE}, var(${CAT_COAT_FILL_VARIABLE}, ${DEFAULT_CAT_COAT}))`,
};

/**
 * 輪郭。猫のページのダークテーマでは、イラストアイコンと同じく毛色に合わせた色になる。
 * BCS では脚の付け根やお腹のラインなど内側の線で体型を見るため、黒系の毛色のライトテーマでは
 * 線が塗りに沈まないよう明るい色（--illustration-cat-line）で描く
 */
const lineStyle: CSSProperties = {
  fill: `var(${CAT_LINE_VARIABLE}, var(${ICON_OUTLINE_STROKE_VARIABLE}, var(--color-illustration-outline, #2e3142)))`,
};

const maskStyle: CSSProperties = { maskType: "alpha" };

type BcsIllustrationProps = {
  name: BcsIllustrationName;
  /** 読み上げる説明。省略すると装飾として読み上げない */
  label?: string;
  className?: string;
  width: number;
  height: number;
};

/**
 * BCS のイラスト。塗り・輪郭のマスクに色を塗り、白い手・オレンジの点線などはそのまま重ねる
 * （下から 塗り・重ね・輪郭 の順に重ねると元の画像と同じ見た目になる）
 */
export function BcsIllustration({
  name,
  label,
  className,
  width,
  height,
}: BcsIllustrationProps) {
  const id = useId();
  const layers = BCS_ILLUSTRATION_LAYERS[name];
  const fillMaskId = `${id}-fill`;
  const lineMaskId = `${id}-line`;
  const box = { x: 0, y: 0, width: layers.width, height: layers.height };

  return (
    <svg
      viewBox={`0 0 ${layers.width} ${layers.height}`}
      width={width}
      height={height}
      className={className}
      focusable="false"
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <mask
          id={fillMaskId}
          maskUnits="userSpaceOnUse"
          {...box}
          style={maskStyle}
        >
          <image href={getBcsIllustrationLayerSrc(name, "fill")} {...box} />
        </mask>
        <mask
          id={lineMaskId}
          maskUnits="userSpaceOnUse"
          {...box}
          style={maskStyle}
        >
          <image href={getBcsIllustrationLayerSrc(name, "line")} {...box} />
        </mask>
      </defs>
      <rect {...box} mask={`url(#${fillMaskId})`} style={fillStyle} />
      {layers.hasOverlay ? (
        <image href={getBcsIllustrationLayerSrc(name, "overlay")} {...box} />
      ) : null}
      <rect {...box} mask={`url(#${lineMaskId})`} style={lineStyle} />
    </svg>
  );
}
