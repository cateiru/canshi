"use client";

import { useId } from "react";
import { TbPhotoPlus, TbVideo, TbX } from "react-icons/tb";
import { Alert } from "@/components/ui";
import styles from "./MediaAttachmentField.module.css";
import type { MediaAttachmentsController } from "./useMediaAttachments";

export type MediaAttachmentFieldProps = {
  controller: MediaAttachmentsController;
  label?: string;
  /** 動画の選択を許可する（`useMediaAttachments` の allowVideo と揃える） */
  allowVideo?: boolean;
  /** 1 枚だけ添付する用途（ごはん商品の画像など）。選択時に既存を置き換える */
  single?: boolean;
  /** ラベルの下に表示する補足 */
  description?: string;
  isDisabled?: boolean;
};

/**
 * 記録フォーム内のファイル選択・プレビュー・削除。
 * 選択したファイルはこの時点では送信せず、フォームの保存時に `useMediaFormAction` がまとめてアップロードする
 */
export function MediaAttachmentField({
  controller,
  label = "写真",
  allowVideo = false,
  single = false,
  description,
  isDisabled = false,
}: MediaAttachmentFieldProps) {
  const inputId = useId();
  const { existing, pending, rejected } = controller;
  // 1 枚制限では常に「差し替え」として選べるようにする
  const canAddMore = single || controller.remainingCount > 0;
  const hasAny = existing.length > 0 || pending.length > 0;
  const accept = allowVideo ? "image/*,video/*" : "image/*";

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {description ? <p className={styles.description}>{description}</p> : null}

      <div className={styles.items}>
        {existing.map((asset) => (
          <div key={asset.id} className={styles.item}>
            <img
              src={asset.thumbnailUrl}
              alt={`添付 ${asset.sortOrder + 1}`}
              className={styles.thumbnail}
            />
            {asset.kind === "video" ? (
              <span className={styles.badge} aria-hidden="true">
                <TbVideo />
              </span>
            ) : null}
            <button
              type="button"
              className={styles.remove}
              aria-label={`添付 ${asset.sortOrder + 1} を削除`}
              onClick={() => controller.removeExisting(asset.id)}
              disabled={isDisabled}
            >
              <TbX aria-hidden="true" />
            </button>
          </div>
        ))}
        {pending.map((item) => (
          <div
            key={item.key}
            className={styles.item}
            data-error={item.error ? "true" : undefined}
          >
            {item.kind === "video" ? (
              <video
                src={item.previewUrl}
                className={styles.thumbnail}
                muted
                playsInline
                preload="metadata"
                aria-label={item.file.name}
              />
            ) : (
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className={styles.thumbnail}
              />
            )}
            {item.kind === "video" ? (
              <span className={styles.badge} aria-hidden="true">
                <TbVideo />
              </span>
            ) : null}
            <button
              type="button"
              className={styles.remove}
              aria-label={`${item.file.name} を取り消す`}
              onClick={() => controller.removePending(item.key)}
              disabled={isDisabled}
            >
              <TbX aria-hidden="true" />
            </button>
            {item.error ? (
              <span className={styles.itemError}>{item.error}</span>
            ) : null}
          </div>
        ))}
        {canAddMore ? (
          <label
            className={styles.picker}
            data-disabled={isDisabled ? "true" : undefined}
          >
            <TbPhotoPlus aria-hidden="true" className={styles.pickerIcon} />
            <span>
              {single ? (hasAny ? "差し替える" : "画像を選ぶ") : "追加する"}
            </span>
            <input
              id={inputId}
              type="file"
              accept={accept}
              multiple={!single}
              disabled={isDisabled}
              className={styles.input}
              onChange={(event) => {
                const files = event.target.files;
                if (files && files.length > 0) {
                  if (single) {
                    controller.replaceAll(Array.from(files));
                  } else {
                    controller.addFiles(Array.from(files));
                  }
                }
                event.target.value = "";
              }}
            />
          </label>
        ) : (
          // 上限に達しているときも input は残し、ラベルからフォーカスできるようにする
          <input
            id={inputId}
            type="file"
            accept={accept}
            disabled
            className={styles.input}
            hidden
          />
        )}
      </div>

      {rejected.length > 0 ? (
        <Alert color="error" className={styles.rejected}>
          <ul className={styles.rejectedList}>
            {rejected.map((item) => (
              <li key={`${item.fileName}-${item.error}`}>
                {item.fileName}：{item.error}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
