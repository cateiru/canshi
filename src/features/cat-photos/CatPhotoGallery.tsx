"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { MediaGallery } from "@/features/media/MediaGallery";
import type { MediaAssetView } from "@/features/media/view";
import type { ProfileImageActionResult } from "./actions";
import styles from "./CatPhotoGallery.module.css";

type CatPhotoGalleryProps = {
  assets: MediaAssetView[];
  /** 現在プロフィールに使っている写真 */
  profileAssetId: string | null;
  isProfilePinned: boolean;
  pinAction: (assetId: string) => Promise<ProfileImageActionResult>;
  unpinAction: () => Promise<ProfileImageActionResult>;
};

/**
 * 写真記録のギャラリー。モーダル内から表示中の写真をプロフィール画像に固定できる
 */
export function CatPhotoGallery({
  assets,
  profileAssetId,
  isProfilePinned,
  pinAction,
  unpinAction,
}: CatPhotoGalleryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (task: () => Promise<ProfileImageActionResult>) => {
    startTransition(async () => {
      const result = await task();
      setError(result.error ?? null);
      if (!result.error) {
        router.refresh();
      }
    });
  };

  return (
    <MediaGallery
      assets={assets}
      title="猫の写真"
      markedAssetId={profileAssetId}
      markedLabel="プロフィール"
      renderActions={(asset) => {
        if (asset.kind !== "image") {
          return null;
        }
        const isCurrent = asset.id === profileAssetId;
        return (
          <div className={styles.actions}>
            {isCurrent && isProfilePinned ? (
              <Button
                variant="secondary"
                isDisabled={isPending}
                onPress={() => run(unpinAction)}
              >
                固定を解除して自動更新に戻す
              </Button>
            ) : (
              <Button
                variant="primary"
                isDisabled={isPending}
                onPress={() => run(() => pinAction(asset.id))}
              >
                {isCurrent
                  ? "この写真をプロフィールに固定する"
                  : "プロフィール画像にする"}
              </Button>
            )}
            {isCurrent ? (
              <span className={styles.status}>
                {isProfilePinned
                  ? "プロフィール画像（固定中）"
                  : "プロフィール画像（最新の写真で自動更新）"}
              </span>
            ) : null}
            {error ? <span className={styles.error}>{error}</span> : null}
          </div>
        );
      }}
    />
  );
}
