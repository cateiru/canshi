"use client";

import { useEffect, useId } from "react";
import {
  Button as AriaButton,
  DropZone,
  FileTrigger,
  isFileDropItem,
} from "react-aria-components";
import {
  TbAlertTriangle,
  TbPhotoPlus,
  TbRefresh,
  TbReplace,
  TbVideo,
  TbX,
} from "react-icons/tb";
import { Alert } from "@/components/ui";
import styles from "./MediaAttachmentField.module.css";
import type {
  MediaAttachmentsController,
  PendingMediaFile,
} from "./useMediaAttachments";
import type { MediaAssetView } from "./view";

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

const IMAGE_TYPES = ["image/*"];
const IMAGE_AND_VIDEO_TYPES = ["image/*", "video/*"];

/**
 * 記録フォーム内のファイル選択・プレビュー・削除。
 * ファイル選択（`FileTrigger`）・ドラッグ＆ドロップ（`DropZone`）の時点で下書きとしてアップロードを始め、
 * 進捗を表示する。フォームの保存時は `useMediaFormAction` がアップロード済みの asset ID だけを送る
 */
export function MediaAttachmentField({
  controller,
  label = "写真",
  allowVideo = false,
  single = false,
  description,
  isDisabled = false,
}: MediaAttachmentFieldProps) {
  // FileTrigger が描画する input の id。見出しの <label> と関連付け、ラベル名で input を特定できるようにする
  const inputId = useId();
  const { existing, pending, rejected } = controller;
  // 1 枚制限では常に「差し替え」として選べるようにする
  const canAddMore = single || controller.remainingCount > 0;
  const acceptedFileTypes = allowVideo ? IMAGE_AND_VIDEO_TYPES : IMAGE_TYPES;
  const canSelect = canAddMore && !isDisabled;

  // 添付欄の外や、上限に達して受け付けない状態でファイルを落とすと、ブラウザがそのファイルを開いて
  // 入力中のフォームが失われる。フォームを表示している間はページ全体でファイルのドロップを無効にする
  useEffect(() => {
    const preventFileDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
      }
    };
    window.addEventListener("dragover", preventFileDrop);
    window.addEventListener("drop", preventFileDrop);
    return () => {
      window.removeEventListener("dragover", preventFileDrop);
      window.removeEventListener("drop", preventFileDrop);
    };
  }, []);

  const handleFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }
    if (single) {
      // 1 枚制限では複数ドロップされても先頭の 1 枚だけを使う
      controller.replaceAll(files.slice(0, 1));
    } else {
      controller.addFiles(files);
    }
  };

  /** ファイル選択ダイアログを開くボタン。同時に描画するのは常に 1 つだけ（input の id が重複しないように） */
  const renderTrigger = (className: string, children: React.ReactNode) => (
    <FileTrigger
      // FileTrigger の props は id を受け付けないため、描画された input に直接付ける
      ref={(input) => {
        if (input) {
          input.id = inputId;
        }
      }}
      acceptedFileTypes={acceptedFileTypes}
      allowsMultiple={!single}
      onSelect={(files) => handleFiles(files ? Array.from(files) : [])}
    >
      <AriaButton className={className} isDisabled={!canSelect}>
        {children}
      </AriaButton>
    </FileTrigger>
  );

  const tiles = [
    ...existing.map((asset) => (
      <ExistingTile
        key={asset.id}
        asset={asset}
        large={single}
        isDisabled={isDisabled}
        onRemove={() => controller.removeExisting(asset.id)}
      />
    )),
    ...pending.map((item) => (
      <PendingTile
        key={item.key}
        item={item}
        large={single}
        isDisabled={isDisabled}
        onRemove={() => controller.removePending(item.key)}
        onRetry={() => controller.retryPending(item.key)}
      />
    )),
  ];

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      {description ? <p className={styles.description}>{description}</p> : null}

      <DropZone
        aria-label="ファイルをドロップして添付"
        className={styles.dropArea}
        isDisabled={!canSelect}
        getDropOperation={() => (canSelect ? "copy" : "cancel")}
        onDrop={async (event) => {
          const files = await Promise.all(
            event.items.filter(isFileDropItem).map((item) => item.getFile()),
          );
          handleFiles(files);
        }}
      >
        {single ? (
          <div className={styles.single}>
            {tiles.length > 0 ? (
              <>
                {tiles}
                {renderTrigger(
                  styles.replaceButton,
                  <>
                    <TbReplace aria-hidden="true" />
                    差し替える
                  </>,
                )}
              </>
            ) : (
              renderTrigger(
                `${styles.chooser} ${styles.dropzone}`,
                <>
                  <TbPhotoPlus
                    aria-hidden="true"
                    className={styles.chooserIcon}
                  />
                  <span className={styles.dropzoneTitle}>画像を選ぶ</span>
                  <span className={styles.dragHint}>
                    またはここにドラッグ＆ドロップ
                  </span>
                </>,
              )
            )}
          </div>
        ) : (
          <>
            <div className={styles.items}>
              {tiles}
              {canAddMore ? (
                renderTrigger(
                  `${styles.chooser} ${styles.picker}`,
                  <>
                    <TbPhotoPlus
                      aria-hidden="true"
                      className={styles.chooserIcon}
                    />
                    <span>追加する</span>
                  </>,
                )
              ) : (
                // 上限に達しているときも input は残し、見出しのラベルと関連付けたままにする
                <input id={inputId} type="file" disabled hidden />
              )}
            </div>
            {canAddMore ? (
              <p className={styles.dragHint}>
                ここにドラッグ＆ドロップしても追加できます
              </p>
            ) : null}
          </>
        )}
      </DropZone>

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

function ExistingTile({
  asset,
  large,
  isDisabled,
  onRemove,
}: {
  asset: MediaAssetView;
  large: boolean;
  isDisabled: boolean;
  onRemove: () => void;
}) {
  const name = `添付 ${asset.sortOrder + 1}`;
  return (
    <div className={styles.item} data-large={large ? "true" : undefined}>
      <img src={asset.thumbnailUrl} alt={name} className={styles.thumbnail} />
      {asset.kind === "video" ? <VideoBadge /> : null}
      <button
        type="button"
        className={styles.remove}
        aria-label={`${name} を削除`}
        onClick={onRemove}
        disabled={isDisabled}
      >
        <TbX aria-hidden="true" />
      </button>
    </div>
  );
}

function PendingTile({
  item,
  large,
  isDisabled,
  onRemove,
  onRetry,
}: {
  item: PendingMediaFile;
  large: boolean;
  isDisabled: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const name = item.file.name;
  const percent = Math.round(item.progress * 100);
  return (
    <div
      className={styles.item}
      data-large={large ? "true" : undefined}
      data-status={item.status}
    >
      {item.kind === "video" ? (
        <video
          src={item.previewUrl}
          className={styles.thumbnail}
          muted
          playsInline
          preload="metadata"
          aria-label={name}
        />
      ) : (
        <img src={item.previewUrl} alt={name} className={styles.thumbnail} />
      )}
      {item.kind === "video" ? <VideoBadge /> : null}

      {item.status === "queued" || item.status === "uploading" ? (
        <div className={styles.overlay}>
          <span className={styles.progressText}>
            {item.status === "queued" ? "待機中" : `${percent}%`}
          </span>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label={`${name} のアップロード`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.status === "queued" ? 0 : percent}
          >
            <div
              className={styles.progressBar}
              // 待機中は CSS のストライプ表示にするため幅を指定しない
              style={
                item.status === "uploading"
                  ? { width: `${percent}%` }
                  : undefined
              }
            />
          </div>
        </div>
      ) : null}

      {item.status === "error" ? (
        <div className={styles.overlay} data-error="true">
          <TbAlertTriangle aria-hidden="true" />
          <span className={styles.itemError}>{item.error}</span>
          <button
            type="button"
            className={styles.retry}
            aria-label={`${name} を再試行`}
            onClick={onRetry}
            disabled={isDisabled}
          >
            <TbRefresh aria-hidden="true" />
            再試行
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.remove}
        aria-label={`${name} を取り消す`}
        onClick={onRemove}
        disabled={isDisabled}
      >
        <TbX aria-hidden="true" />
      </button>
    </div>
  );
}

function VideoBadge() {
  return (
    <span className={styles.badge} aria-hidden="true">
      <TbVideo />
    </span>
  );
}
