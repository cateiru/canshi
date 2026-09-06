import type { HTMLAttributes } from "react";
import styles from "./CatEarFrame.module.css";

export type CatEarFrameProps = HTMLAttributes<HTMLDivElement>;

/**
 * 左上に猫耳を模した装飾を付けた、ソリッドな枠線を持つ共通コンテナ。
 * Card・Modal など、枠線で囲む UI 要素はこのコンポーネントを土台にする。
 */
export function CatEarFrame({
  className,
  children,
  ...props
}: CatEarFrameProps) {
  const classes = className ? `${styles.frame} ${className}` : styles.frame;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
