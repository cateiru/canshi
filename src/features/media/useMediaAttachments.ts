"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteMediaAssetAction } from "./actions";
import type { MediaLimits } from "./limits";
import { isVideoFile, uploadMedia, validateFileForUpload } from "./upload";
import type { MediaAssetView } from "./view";

/**
 * フォーム上で選択した未保存のファイル
 */
export type PendingMediaFile = {
  key: string;
  file: File;
  /** プレビュー用の Object URL */
  previewUrl: string;
  kind: "image" | "video";
  /** アップロードに失敗した場合のメッセージ */
  error?: string;
};

export type MediaCommitTarget = {
  recordType: string;
  recordId: string;
};

export type MediaCommitResult = {
  /** アップロードに失敗したファイル（フォームの pending にも残る） */
  failed: { fileName: string; error: string }[];
};

export type MediaAttachmentsController = {
  /** 既存の添付（削除予定を除く） */
  existing: MediaAssetView[];
  /** 未保存の添付 */
  pending: PendingMediaFile[];
  /** ファイル選択時の事前チェックで弾いたファイルのメッセージ */
  rejected: { fileName: string; error: string }[];
  addFiles: (files: Iterable<File>) => void;
  /** 既存・未保存の添付をすべて置き換える（1 枚制限のフィールド用） */
  replaceAll: (files: Iterable<File>) => void;
  removePending: (key: string) => void;
  removeExisting: (assetId: string) => void;
  clearRejected: () => void;
  /** 添付できる残り枚数（maxCount 未指定なら Infinity） */
  remainingCount: number;
  /**
   * 記録の保存後に呼ぶ。削除予定の既存添付を削除し、未保存のファイルを順にアップロードする。
   * 成功したものは pending から取り除き、失敗したものはエラー付きで残す
   */
  commit: (target: MediaCommitTarget) => Promise<MediaCommitResult>;
};

export type UseMediaAttachmentsOptions = {
  initial?: MediaAssetView[];
  limits: MediaLimits;
  allowVideo?: boolean;
  /** 添付できる合計枚数の上限（既存＋未保存） */
  maxCount?: number;
};

export function useMediaAttachments({
  initial = [],
  limits,
  allowVideo = false,
  maxCount,
}: UseMediaAttachmentsOptions): MediaAttachmentsController {
  const [existing, setExisting] = useState<MediaAssetView[]>(initial);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingMediaFile[]>([]);
  const [rejected, setRejected] = useState<
    { fileName: string; error: string }[]
  >([]);
  // アンマウント時に Object URL を解放するため、最新の pending を参照で保持する
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

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
        });
      }
      return { accepted, errors };
    },
    [allowVideo, limits, maxCount],
  );

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      const { accepted, errors } = selectFiles(files, remainingCount);
      if (accepted.length > 0) {
        setPending((current) => [...current, ...accepted]);
      }
      setRejected(errors);
    },
    [selectFiles, remainingCount],
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
      setRemovedIds(existing.map((asset) => asset.id));
      setPending((current) => {
        for (const item of current) {
          URL.revokeObjectURL(item.previewUrl);
        }
        return accepted;
      });
    },
    [selectFiles, maxCount, existing],
  );

  const removePending = useCallback((key: string) => {
    setPending((current) => {
      const target = current.find((item) => item.key === key);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.key !== key);
    });
  }, []);

  const removeExisting = useCallback((assetId: string) => {
    setRemovedIds((current) =>
      current.includes(assetId) ? current : [...current, assetId],
    );
  }, []);

  const clearRejected = useCallback(() => setRejected([]), []);

  const commit = useCallback(
    async (target: MediaCommitTarget): Promise<MediaCommitResult> => {
      const failed: { fileName: string; error: string }[] = [];

      // 既存添付の削除。失敗しても記録自体は保存済みのため、メッセージだけ残して続行する
      const deletedIds: string[] = [];
      for (const assetId of removedIds) {
        const result = await deleteMediaAssetAction(assetId);
        if (result.error) {
          const asset = existing.find((item) => item.id === assetId);
          failed.push({
            fileName: asset ? `添付 ${asset.sortOrder + 1}` : assetId,
            error: result.error,
          });
        } else {
          deletedIds.push(assetId);
        }
      }
      if (deletedIds.length > 0) {
        setExisting((current) =>
          current.filter((asset) => !deletedIds.includes(asset.id)),
        );
        setRemovedIds((current) =>
          current.filter((id) => !deletedIds.includes(id)),
        );
      }

      // 未保存ファイルのアップロード。順序（sort_order）を保つため直列に送る
      const uploaded: MediaAssetView[] = [];
      const succeededKeys: string[] = [];
      const errorsByKey = new Map<string, string>();
      for (const item of pendingRef.current) {
        try {
          const asset = await uploadMedia({ file: item.file, ...target });
          uploaded.push(asset);
          succeededKeys.push(item.key);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "アップロードに失敗しました";
          errorsByKey.set(item.key, message);
          failed.push({ fileName: item.file.name, error: message });
        }
      }
      if (uploaded.length > 0) {
        setExisting((current) => [...current, ...uploaded]);
      }
      setPending((current) =>
        current
          .filter((item) => {
            if (succeededKeys.includes(item.key)) {
              URL.revokeObjectURL(item.previewUrl);
              return false;
            }
            return true;
          })
          .map((item) =>
            errorsByKey.has(item.key)
              ? { ...item, error: errorsByKey.get(item.key) }
              : item,
          ),
      );

      return { failed };
    },
    [existing, removedIds],
  );

  return {
    existing: visibleExisting,
    pending,
    rejected,
    addFiles,
    replaceAll,
    removePending,
    removeExisting,
    clearRejected,
    remainingCount,
    commit,
  };
}
