import type { HTMLAttributes } from "react";
import styles from "./Badge.module.css";

export type BadgeColor = "info" | "success" | "warning" | "error" | "accent";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  color?: BadgeColor;
};

/**
 * 文字色・背景色は変えず、輪郭の色のみで種別を表現するバッジ。
 */
export function Badge({ color = "info", className, ...props }: BadgeProps) {
  const classes = [styles.badge, styles[color], className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} {...props} />;
}
