import type { HTMLAttributes } from "react";
import styles from "./Alert.module.css";

export type AlertColor = "info" | "success" | "warning" | "error";

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  color?: AlertColor;
};

/**
 * react-aria-components に汎用の Alert プリミティブは存在しないため、
 * role="alert" を付与した素の div として実装する。
 */
export function Alert({ color = "info", className, ...props }: AlertProps) {
  const classes = [styles.alert, styles[color], className]
    .filter(Boolean)
    .join(" ");

  return <div role="alert" className={classes} {...props} />;
}
