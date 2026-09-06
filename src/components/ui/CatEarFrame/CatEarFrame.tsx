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
      {/* viewBox の座標はデザイントークン（space-1: 4 / space-2: 8 / space-3: 12）を px 換算した固定値 */}
      <svg
        className={styles.ears}
        viewBox="0 0 28 8"
        aria-hidden="true"
        focusable="false"
      >
        {/* polyline にして底辺のストロークは描かず、frame 自体の border-top に馴染ませる */}
        <polyline className={styles.ear} points="4,8 8,0 12,8" />
        <polyline className={styles.ear} points="16,8 20,0 24,8" />
      </svg>
      <span className={`${styles.overlay} ${styles.ears}`} />
      {children}
    </div>
  );
}
