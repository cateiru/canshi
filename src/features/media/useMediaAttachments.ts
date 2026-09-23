"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { discardPendingMediaAction } from "./actions";
import type { MediaLimits } from "./limits";
import {
  isVideoFile,
  uploadPendingMedia,
  validateFileForUpload,
} from "./upload";
import type { MediaAssetView } from "./view";

export type PendingMediaStatus = "queued" | "uploading" | "uploaded" | "error";

/**
 * フォーム上で選択した、まだ記録に紐付いていないファイル。
 * 選択した時点で下書きとしてアップロードを始め、記録の保存時に asset ID だけを送る
 */
export type PendingMediaFile = {
  key: string;
  file: File;
  /** プレビュー用の Object URL */
  previewUrl: string;
  kind: "image" | "video";
  status: PendingMediaStatus;
  /** 送信の進捗（0〜1） */
  progress: number;
  /** アップロード済みの下書き */
  asset?: MediaAssetView;
  /** アップロードに失敗した場合のメッセージ */
  error?: string;
};

export type MediaUploadSummary = {
  /** フォームに送る asset ID（表示順） */
  assetIds: string[];
  /** アップロードに失敗したファイル */
  failed: { fileName: string; error: string }[];
};

export type MediaAttachmentsController = {
  /** 既存の添付（削除予定を除く） */
  existing: MediaAssetView[];
  /** 未保存の添付（アップロード中・済み・失敗） */
  pending: PendingMediaFile[];
  /** ファイル選択時の事前チェックで弾いたファイルのメッセージ */
  rejected: { fileName: string; error: string }[];
  addFiles: (files: Iterable<File>) => void;
  /** 既存・未保存の添付をすべて置き換える（1 枚制限のフィールド用） */
  replaceAll: (files: Iterable<File>) => void;
  removePending: (key: string) => void;
  removeExisting: (assetId: string) => void;
  /** アップロードに失敗したファイルを送り直す */
  retryPending: (key: string) => void;
  clearRejected: () => void;
  /** 添付できる残り枚数（maxCount 未指定なら Infinity） */
  remainingCount: number;
  /** アップロード待ち・アップロード中のファイルがあるか */
  isUploading: boolean;
  /**
   * 記録の保存前に呼ぶ。進行中のアップロードがすべて終わるのを待ち、
   * フォームに送る asset ID と失敗したファイルを返す
   */
  waitForUploads: () => Promise<MediaUploadSummary>;
};

export type UseMediaAttachmentsOptions = {
  initial?: MediaAssetView[];
  limits: MediaLimits;
  allowVideo?: boolean;
  /** 添付できる合計枚数の上限（既存＋未保存） */
  maxCount?: number;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useMediaAttachments({
  initial = [],
  limits,
  allowVideo = false,
  maxCount,
}: UseMediaAttachmentsOptions): MediaAttachmentsController {
  const [existing] = useState<MediaAssetView[]>(initial);
  const [removedIds, setRemovedIdsState] = useState<string[]>([]);
  const [pending, setPendingState] = useState<PendingMediaFile[]>([]);
  const [rejected, setRejected] = useState<
    { fileName: string; error: string }[]
  >([]);

  // 送信時（Transition 中で再レンダリング前のこともある）に最新の状態を読めるよう、
  // 状態の更新は必ず ref を先に書き換えてから setState する
  const pendingRef = useRef<PendingMediaFile[]>([]);
  const removedIdsRef = useRef<string[]>([]);
  const setPending = useCallback(
    (update: (current: PendingMediaFile[]) => PendingMediaFile[]) => {
      pendingRef.current = update(pendingRef.current);
      setPendingState(pendingRef.current);
    },
    [],
  );
  const setRemovedIds = useCallback(
    (update: (current: string[]) => string[]) => {
      removedIdsRef.current = update(removedIdsRef.current);
      setRemovedIdsState(removedIdsRef.current);
    },
    [],
  );
  const updateItem = useCallback(
    (key: string, patch: Partial<PendingMediaFile>) => {
      setPending((current) =>
        current.map((item) =>
          item.key === key ? { ...item, ...patch } : item,
        ),
      );
    },
    [setPending],
  );

  // Workers のメモリ上限を考慮し、アップロードは 1 件ずつ直列に行う。
  // 末尾の Promise を保持しておき、保存時はそれを待てばすべて終わったことになる
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const abortersRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const aborters = abortersRef.current;
    return () => {
      for (const aborter of aborters.values()) {
        aborter.abort();
      }
      for (const item of pendingRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const runUpload = useCallback(
    async (key: string) => {
      const item = pendingRef.current.find((entry) => entry.key === key);
      // 待っている間に取り消された、または再試行で重複して積まれた場合
      if (item?.status !== "queued") {
        return;
      }
      const aborter = new AbortController();
      abortersRef.current.set(key, aborter);
      updateItem(key, { status: "uploading", progress: 0, error: undefined });
      try {
        const asset = await uploadPendingMedia(item.file, {
          signal: aborter.signal,
          onProgress: (progress) => updateItem(key, { progress }),
        });
        if (pendingRef.current.some((entry) => entry.key === key)) {
          updateItem(key, { status: "uploaded", progress: 1, asset });
        } else {
          // 送信が終わる直前に取り消された場合は、できあがった下書きを片付ける
          void discardPendingMediaAction(asset.id);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        updateItem(key, {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "アップロードに失敗しました",
        });
      } finally {
        abortersRef.current.delete(key);
      }
    },
    [updateItem],
  );

  const enqueue = useCallback(
    (keys: string[]) => {
      for (const key of keys) {
        queueRef.current = queueRef.current.then(() => runUpload(key));
      }
    },
    [runUpload],
  );

  const visibleExisting = existing.filter(
    (asset) => !removedIds.includes(asset.id),
  );
  const remainingCount =
    maxCount == null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, maxCount - visibleExisting.length - pending.length);

  const selectFiles = useCallback(
    (files: Iterable<File>, remainingCount: number) => {
      const accepted: PendingMediaFile[] = [];
      const errors: { fileName: string; error: string }[] = [];
      let remaining = remainingCount;
      for (const file of files) {
        const error = validateFileForUpload(file, { allowVideo, limits });
        if (error) {
          errors.push({ fileName: file.name, error });
          continue;
        }
        if (remaining <= 0) {
          errors.push({
            fileName: file.name,
            error: `添付できるのは ${maxCount} 枚までです`,
          });
          continue;
        }
        remaining -= 1;
        accepted.push({
          key: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          kind: isVideoFile(file) ? "video" : "image",
          status: "queued",
          progress: 0,
        });
      }
      return { accepted, errors };
    },
    [allowVideo, limits, maxCount],
  );

  /** 未保存のファイルを取り除く。進行中なら中止し、アップロード済みの下書きは削除する */
  const dropPending = useCallback((items: PendingMediaFile[]) => {
    for (const item of items) {
      abortersRef.current.get(item.key)?.abort();
      if (item.asset) {
        void discardPendingMediaAction(item.asset.id);
      }
      URL.revokeObjectURL(item.previewUrl);
    }
  }, []);

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      const { accepted, errors } = selectFiles(files, remainingCount);
      setRejected(errors);
      if (accepted.length === 0) {
        return;
      }
      setPending((current) => [...current, ...accepted]);
      enqueue(accepted.map((item) => item.key));
    },
    [selectFiles, remainingCount, setPending, enqueue],
  );

  const replaceAll = useCallback(
    (files: Iterable<File>) => {
      const { accepted, errors } = selectFiles(
        files,
        maxCount ?? Number.POSITIVE_INFINITY,
      );
      setRejected(errors);
      if (accepted.length === 0) {
        return;
      }
      setRemovedIds(() => existing.map((asset) => asset.id));
      dropPending(pendingRef.current);
      setPending(() => accepted);
      enqueue(accepted.map((item) => item.key));
    },
    [
      selectFiles,
      maxCount,
      existing,
      setRemovedIds,
      dropPending,
      setPending,
      enqueue,
    ],
  );

  const removePending = useCallback(
    (key: string) => {
      const target = pendingRef.current.find((item) => item.key === key);
      if (!target) {
        return;
      }
      setPending((current) => current.filter((item) => item.key !== key));
      dropPending([target]);
    },
    [setPending, dropPending],
  );

  const removeExisting = useCallback(
    (assetId: string) => {
      setRemovedIds((current) =>
        current.includes(assetId) ? current : [...current, assetId],
      );
    },
    [setRemovedIds],
  );

  const retryPending = useCallback(
    (key: string) => {
      const target = pendingRef.current.find((item) => item.key === key);
      if (target?.status !== "error") {
        return;
      }
      updateItem(key, { status: "queued", progress: 0, error: undefined });
      enqueue([key]);
    },
    [updateItem, enqueue],
  );

  const clearRejected = useCallback(() => setRejected([]), []);

  const waitForUploads = useCallback(async (): Promise<MediaUploadSummary> => {
    // 待っている間に再試行などで新しいアップロードが積まれた場合も、それが終わるまで待つ
    let tail: Promise<void>;
    do {
      tail = queueRef.current;
      await tail;
    } while (tail !== queueRef.current);

    const assetIds = existing
      .filter((asset) => !removedIdsRef.current.includes(asset.id))
      .map((asset) => asset.id);
    const failed: MediaUploadSummary["failed"] = [];
    for (const item of pendingRef.current) {
      if (item.asset) {
        assetIds.push(item.asset.id);
      } else {
        failed.push({
          fileName: item.file.name,
          error: item.error ?? "アップロードに失敗しました",
        });
      }
    }
    return { assetIds, failed };
  }, [existing]);

  return {
    existing: visibleExisting,
    pending,
    rejected,
    addFiles,
    replaceAll,
    removePending,
    removeExisting,
    retryPending,
    clearRejected,
    remainingCount,
    isUploading: pending.some(
      (item) => item.status === "queued" || item.status === "uploading",
    ),
    waitForUploads,
  };
}
