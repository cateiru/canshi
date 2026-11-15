import { type CSSProperties, useId } from "react";
import {
  CAT_COAT_FILL_VARIABLE,
  ICON_OUTLINE_STROKE_VARIABLE,
} from "@/components/ui/RecordIcons/RecordIcons";
import {
  BCS_ILLUSTRATION_DEFAULT_FILL,
  BCS_ILLUSTRATION_LAYERS,
  type BcsIllustrationName,
} from "./bcsIllustrationLayers";
import { getBcsIllustrationLayerSrc } from "./bcsIllustrations";

/**
 * 猫の塗り。イラストアイコン（RecordIcons）と同じ変数を使い、猫のページでは毛色
 * （サビ・ブルークリームは斑の SVG パターン）で塗る。未設定なら元の画像のベージュ
 */
const fillStyle: CSSProperties = {
  fill: `var(${CAT_COAT_FILL_VARIABLE}, ${BCS_ILLUSTRATION_DEFAULT_FILL})`,
};

/** 輪郭。イラストアイコンと同じく、猫のページのダークテーマでは毛色に合わせた色になる */
const lineStyle: CSSProperties = {
  fill: `var(${ICON_OUTLINE_STROKE_VARIABLE}, var(--color-illustration-outline, #2e3142))`,
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
      {/* 毛色の斑（パターン）が猫ごとに付くよう、塗りは猫ごとの矩形に分ける */}
      <g mask={`url(#${fillMaskId})`} style={fillStyle}>
        {layers.regions.map((region) => (
          <rect key={`${region.x}-${region.y}`} {...region} />
        ))}
      </g>
      {layers.hasOverlay ? (
        <image href={getBcsIllustrationLayerSrc(name, "overlay")} {...box} />
      ) : null}
      <rect {...box} mask={`url(#${lineMaskId})`} style={lineStyle} />
    </svg>
  );
}
