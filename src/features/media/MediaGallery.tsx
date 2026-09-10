"use client";

import { type ReactNode, useState } from "react";
import { TbChevronLeft, TbChevronRight, TbVideo } from "react-icons/tb";
import { Button, Modal } from "@/components/ui";
import styles from "./MediaGallery.module.css";
import type { MediaAssetView } from "./view";

export type MediaGalleryVariant = "grid" | "strip";

/**
 * モーダルでの元データの表示方法。
 * contain: 画面に収まるよう縮小する（写真向け）。actual: 等倍で表示しスクロール・ピンチで拡大する（書類向け）
 */
export type MediaGalleryFit = "contain" | "actual";

export type MediaGalleryProps = {
  assets: MediaAssetView[];
  /** grid: 一覧・詳細向け（既定）。strip: タイムラインなど小さな領域向けの横並び */
  variant?: MediaGalleryVariant;
  fit?: MediaGalleryFit;
  /** モーダルのタイトル（スクリーンリーダー向け） */
  title?: string;
  /** サムネイルに印を付ける添付（プロフィール画像など）と、その印のラベル */
  markedAssetId?: string | null;
  markedLabel?: string;
  /** モーダル内の操作ボタン（表示中の添付に対する操作） */
  renderActions?: (asset: MediaAssetView) => ReactNode;
};

/**
 * 一覧・詳細画面でのサムネイル表示と、タップで元データを表示するモーダル
 */
export function MediaGallery({
  assets,
  variant = "grid",
  fit = "contain",
  title = "添付",
  markedAssetId,
  markedLabel = "選択中",
  renderActions,
}: MediaGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (assets.length === 0) {
    return null;
  }

  const current = openIndex == null ? null : assets[openIndex];
  const hasPrev = openIndex != null && openIndex > 0;
  const hasNext = openIndex != null && openIndex < assets.length - 1;

  return (
    <>
      <ul className={`${styles.list} ${styles[variant]}`}>
        {assets.map((asset, index) => (
          <li key={asset.id} className={styles.item}>
            <button
              type="button"
              className={styles.thumbnailButton}
              onClick={() => setOpenIndex(index)}
              aria-label={`${title} ${index + 1} を表示`}
            >
              <img
                src={asset.thumbnailUrl}
                alt=""
                className={styles.thumbnail}
                width={asset.width ?? undefined}
                height={asset.height ?? undefined}
                loading="lazy"
              />
              {asset.kind === "video" ? (
                <span className={styles.badge} aria-hidden="true">
                  <TbVideo />
                </span>
              ) : null}
              {markedAssetId != null && asset.id === markedAssetId ? (
                <span className={styles.mark}>{markedLabel}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={current != null}
        onClose={() => setOpenIndex(null)}
        size="lg"
        title={
          current
            ? `${title} ${(openIndex ?? 0) + 1} / ${assets.length}`
            : undefined
        }
      >
        {current ? (
          <div className={styles.viewer}>
            <div className={`${styles.stage} ${styles[`fit-${fit}`]}`}>
              {current.kind === "video" ? (
                // biome-ignore lint/a11y/useMediaCaption: 利用者自身が撮影した記録用の動画のため字幕は持たない
                <video
                  key={current.id}
                  src={current.url}
                  controls
                  playsInline
                  className={styles.media}
                />
              ) : (
                <img
                  key={current.id}
                  src={current.url}
                  alt={`${title} ${(openIndex ?? 0) + 1}`}
                  className={styles.media}
                  width={current.width ?? undefined}
                  height={current.height ?? undefined}
                />
              )}
            </div>
            <div className={styles.nav}>
              {assets.length > 1 ? (
                <div className={styles.pager}>
                  <Button
                    variant="secondary"
                    isDisabled={!hasPrev}
                    onPress={() => setOpenIndex((index) => (index ?? 0) - 1)}
                  >
                    <TbChevronLeft aria-hidden="true" />
                    前へ
                  </Button>
                  <Button
                    variant="secondary"
                    isDisabled={!hasNext}
                    onPress={() => setOpenIndex((index) => (index ?? 0) + 1)}
                  >
                    次へ
                    <TbChevronRight aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <span />
              )}
              <Button variant="secondary" onPress={() => setOpenIndex(null)}>
                閉じる
              </Button>
            </div>
            {renderActions ? (
              <div className={styles.actions}>{renderActions(current)}</div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
