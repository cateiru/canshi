"use client";

import { type ReactNode, useState } from "react";
import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";
import styles from "./ImagePreview.module.css";
import { type ImageFit, ImageStage } from "./ImageStage";

export type ImagePreviewProps = {
  /** サムネイルの URL。ないときは fallback を表示する */
  src: string | null | undefined;
  /** 画像の説明。装飾だけの画像（ボタンの名前で内容が分かるときなど）は空文字にする */
  alt: string;
  /** 画像がないときに代わりに表示する要素（アイコンなど） */
  fallback?: ReactNode;
  /** fallback を表示するときの読み上げ用のラベル。省略すると表示しない（装飾として扱う） */
  fallbackLabel?: string;
  /** サムネイルの大きさ・角丸などの見た目 */
  className?: string;
  width?: number;
  height?: number;
  /** 画面外のサムネイルは表示されるまで読み込まない（既定）。一覧の先頭など、すぐに見える画像は eager にする */
  loading?: "lazy" | "eager";
  /**
   * 拡大表示する元画像の URL。指定すると、サムネイルを押したときにモーダルで拡大表示する
   */
  previewSrc?: string;
  /** 拡大表示の表示方法 */
  fit?: ImageFit;
};

/**
 * サムネイル画像の表示。遅延読み込み・画像がないときの代替表示と、
 * previewSrc を指定したときのタップでの拡大表示をまとめて持つ
 */
export function ImagePreview({
  src,
  alt,
  fallback,
  fallbackLabel,
  className,
  width,
  height,
  loading = "lazy",
  previewSrc,
  fit = "contain",
}: ImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) {
    return fallbackLabel ? (
      <span role="img" aria-label={fallbackLabel} className={className}>
        {fallback}
      </span>
    ) : (
      <span aria-hidden="true" className={className}>
        {fallback}
      </span>
    );
  }

  const thumbnail = (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={loading}
    />
  );

  if (!previewSrc) {
    return thumbnail;
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(true)}
        aria-label={alt ? `${alt}を拡大して表示` : "画像を拡大して表示"}
      >
        {thumbnail}
      </button>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        size="lg"
        // alt が空でもダイアログに名前が付くよう、既定のタイトルを渡す
        title={alt || "画像"}
      >
        <div className={styles.viewer}>
          <ImageStage fit={fit}>
            <img src={previewSrc} alt={alt} />
          </ImageStage>
          <div className={styles.viewerActions}>
            <Button variant="secondary" onPress={() => setIsOpen(false)}>
              閉じる
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
