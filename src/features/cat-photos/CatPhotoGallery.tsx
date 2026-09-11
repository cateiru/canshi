"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Modal } from "@/components/ui";
import { ProfileCropEditor } from "@/features/cats/ProfileCropEditor";
import {
  DEFAULT_PROFILE_CROP,
  type ProfileCrop,
} from "@/features/cats/profileCrop";
import { MediaGallery } from "@/features/media/MediaGallery";
import type { MediaAssetView } from "@/features/media/view";
import type { ProfileImageActionResult } from "./actions";
import styles from "./CatPhotoGallery.module.css";

type CatPhotoGalleryProps = {
  assets: MediaAssetView[];
  /** 現在プロフィールに使っている写真 */
  profileAssetId: string | null;
  isProfilePinned: boolean;
  /** 固定中の写真の表示位置（object-position と同じ 0〜100 の百分率） */
  profileCropX: number | null;
  profileCropY: number | null;
  pinAction: (
    assetId: string,
    crop: ProfileCrop,
  ) => Promise<ProfileImageActionResult>;
  unpinAction: () => Promise<ProfileImageActionResult>;
};

/**
 * 写真記録のギャラリー。モーダル内の「プロフィールに固定」から、別モーダルで
 * 表示位置を選んでプロフィール画像に固定できる
 */
export function CatPhotoGallery({
  assets,
  profileAssetId,
  isProfilePinned,
  profileCropX,
  profileCropY,
  pinAction,
  unpinAction,
}: CatPhotoGalleryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<MediaAssetView | null>(null);
  const [cropValue, setCropValue] = useState<ProfileCrop>(DEFAULT_PROFILE_CROP);

  const openCropModal = (asset: MediaAssetView) => {
    setError(null);
    setCropValue(
      asset.id === profileAssetId &&
        profileCropX != null &&
        profileCropY != null
        ? { x: profileCropX, y: profileCropY }
        : DEFAULT_PROFILE_CROP,
    );
    setCropTarget(asset);
  };

  const confirmCrop = () => {
    if (!cropTarget) {
      return;
    }
    const assetId = cropTarget.id;
    const crop = cropValue;
    startTransition(async () => {
      const result = await pinAction(assetId, crop);
      setError(result.error ?? null);
      if (!result.error) {
        setCropTarget(null);
        router.refresh();
      }
    });
  };

  const runUnpin = () => {
    startTransition(async () => {
      const result = await unpinAction();
      setError(result.error ?? null);
      if (!result.error) {
        router.refresh();
      }
    });
  };

  return (
    <>
      <MediaGallery
        assets={assets}
        title="猫の写真"
        markedAssetId={profileAssetId}
        markedLabel="プロフィール"
        renderNavActions={(asset) => {
          if (asset.kind !== "image") {
            return null;
          }
          return (
            <Button
              variant="primary"
              isDisabled={isPending}
              onPress={() => openCropModal(asset)}
            >
              プロフィールに固定
            </Button>
          );
        }}
        renderActions={(asset) => {
          if (asset.kind !== "image" || asset.id !== profileAssetId) {
            return null;
          }
          return (
            <div className={styles.actions}>
              <span className={styles.status}>
                {isProfilePinned
                  ? "プロフィール画像（固定中）"
                  : "プロフィール画像（最新の写真で自動更新）"}
              </span>
              {isProfilePinned ? (
                <Button
                  variant="secondary"
                  isDisabled={isPending}
                  onPress={runUnpin}
                >
                  固定を解除して自動更新に戻す
                </Button>
              ) : null}
            </div>
          );
        }}
      />

      <Modal
        open={cropTarget != null}
        onClose={() => setCropTarget(null)}
        title="プロフィール画像の位置を選ぶ"
      >
        {cropTarget ? (
          <div className={styles.cropModalBody}>
            <ProfileCropEditor
              imageUrl={cropTarget.url}
              value={cropValue}
              onChange={setCropValue}
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.buttonRow}>
              <Button
                variant="primary"
                isDisabled={isPending}
                onPress={confirmCrop}
              >
                この位置に固定する
              </Button>
              <Button
                variant="secondary"
                isDisabled={isPending}
                onPress={() => setCropTarget(null)}
              >
                キャンセル
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
