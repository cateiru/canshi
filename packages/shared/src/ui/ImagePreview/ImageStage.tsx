import type { ReactNode } from "react";
import styles from "./ImagePreview.module.css";

/**
 * 拡大表示での画像の表示方法。
 * contain: 画面に収まるよう縮小する（写真向け）。actual: 等倍で表示しスクロール・ピンチで拡大する（書類向け）
 */
export type ImageFit = "contain" | "actual";

export type ImageStageProps = {
  fit?: ImageFit;
  /** 表示する img または video。表示方法（fit）に合わせた大きさはこのコンポーネントが決める */
  children: ReactNode;
};

/** モーダルで画像（または動画）を大きく表示する領域 */
export function ImageStage({ fit = "contain", children }: ImageStageProps) {
  return <div className={`${styles.stage} ${styles[fit]}`}>{children}</div>;
}
