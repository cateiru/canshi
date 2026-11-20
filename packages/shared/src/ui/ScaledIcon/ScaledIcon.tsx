import type { ComponentType } from "react";
import type { IconBaseProps } from "react-icons";

type ScaledIconProps = Omit<IconBaseProps, "size"> & {
  icon: ComponentType<IconBaseProps>;
  /** 標準の文字サイズでの大きさ（px） */
  size: number;
};

/** 文字サイズに追従し、隣の文字が長くても潰れないアイコン */
export function ScaledIcon({
  icon: Icon,
  size,
  style,
  ...props
}: ScaledIconProps) {
  return (
    <Icon
      {...props}
      size={`calc(${size}px * var(--font-scale))`}
      style={{ flexShrink: 0, ...style }}
    />
  );
}
