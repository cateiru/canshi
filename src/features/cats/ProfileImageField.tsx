"use client";

import { useEffect, useId, useState } from "react";
import { Button as AriaButton, FileTrigger } from "react-aria-components";
import { TbPhotoPlus, TbTrash } from "react-icons/tb";
import { Button, Modal } from "@/components/ui";
import { getButtonClassName } from "@/components/ui/Button/buttonStyles";
import { discardPendingMediaAction } from "@/features/media/actions";
import { uploadPendingMedia } from "@/features/media/upload";
import { CatAvatar } from "./CatAvatar";
import { cropProfileImage } from "./cropProfileImage";
import {
  ProfileCropEditor,
  type ProfileCropSelection,
} from "./ProfileCropEditor";
import styles from "./ProfileImageField.module.css";
import {
  PROFILE_IMAGE_ACTION_FIELD,
  PROFILE_IMAGE_ASSET_ID_FIELD,
} from "./profileImageForm";

type ProfileImageFieldProps = {
  catName: string;
  profileMediaAssetId: string | null;
  profileCropX: number | null;
  profileCropY: number | null;
  profileCropZoom: number | null;
  profileCropRotation: number | null;
  /** 切り抜き・アップロード中は true（フォームの送信を止めるため） */
  onBusyChange: (isBusy: boolean) => void;
  isDisabled?: boolean;
};

/** 保存時にプロフィール画像をどうするか */
type Selection =
  | { type: "keep" }
  | { type: "set"; assetId: string }
  | { type: "remove" };

/**
 * 猫の編集フォームのプロフィール画像欄。画像を選ぶと切り抜き用のモーダルを開き、
 * 正方形に切り抜いた画像をブラウザで作ってから下書きとしてアップロードする。
 * フォームの保存時に asset ID を送り、`updateCatAction` がプロフィール画像として紐付ける
 */
export function ProfileImageField({
  catName,
  profileMediaAssetId,
  profileCropX,
  profileCropY,
  profileCropZoom,
  profileCropRotation,
  onBusyChange,
  isDisabled = false,
}: ProfileImageFieldProps) {
  const inputId = useId();
  const [selection, setSelection] = useState<Selection>({ type: "keep" });
  // 切り抜き中の元画像（ObjectURL）
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [cropSelection, setCropSelection] =
    useState<ProfileCropSelection | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange(isUploading || sourceUrl != null);
  }, [isUploading, sourceUrl, onBusyChange]);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  /** 保存前に選び直した・外した下書きは不要になるため消しておく（失敗しても期限切れで消える） */
  const discardSelectedDraft = () => {
    if (selection.type === "set") {
      void discardPendingMediaAction(selection.assetId);
    }
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    // 切り抜いた後の小さな画像をアップロードするため、元画像のサイズは問わない
    if (!file.type.startsWith("image/")) {
      setError("画像を選んでください");
      return;
    }
    setError(null);
    setCropSelection(null);
    setSourceUrl(URL.createObjectURL(file));
  };

  const closeCropModal = () => {
    if (!isUploading) {
      setSourceUrl(null);
    }
  };

  const confirmCrop = async () => {
    if (!sourceUrl || !cropSelection) {
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const file = await cropProfileImage(
        sourceUrl,
        cropSelection.area,
        cropSelection.rotation,
      );
      const asset = await uploadPendingMedia(file);
      discardSelectedDraft();
      setSelection({ type: "set", assetId: asset.id });
      setSourceUrl(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "画像のアップロードに失敗しました",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    discardSelectedDraft();
    setSelection({ type: "remove" });
    setError(null);
  };

  const previewAssetId =
    selection.type === "set"
      ? selection.assetId
      : selection.type === "remove"
        ? null
        : profileMediaAssetId;
  // 以前の写真記録から選んだ画像だけが表示位置・ズーム・回転の値を持つ
  const keepsLegacyCrop = selection.type === "keep";

  return (
    <div className={styles.field}>
      <div className={styles.body}>
        <CatAvatar
          name={catName}
          profileMediaAssetId={previewAssetId}
          profileCropX={keepsLegacyCrop ? profileCropX : null}
          profileCropY={keepsLegacyCrop ? profileCropY : null}
          profileCropZoom={keepsLegacyCrop ? profileCropZoom : null}
          profileCropRotation={keepsLegacyCrop ? profileCropRotation : null}
          size="lg"
        />
        <div className={styles.controls}>
          <FileTrigger
            // FileTrigger の props は id を受け付けないため、描画された input に直接付ける
            ref={(input) => {
              if (input) {
                input.id = inputId;
              }
            }}
            acceptedFileTypes={["image/*"]}
            onSelect={handleFiles}
          >
            <AriaButton
              className={getButtonClassName("secondary")}
              isDisabled={isDisabled || isUploading}
            >
              <TbPhotoPlus aria-hidden="true" size={18} />
              {previewAssetId ? "画像を変更する" : "画像を選ぶ"}
            </AriaButton>
          </FileTrigger>
          {previewAssetId ? (
            <Button
              variant="secondary"
              isDisabled={isDisabled || isUploading}
              onPress={removeImage}
              leftIcon={TbTrash}
            >
              画像を外す
            </Button>
          ) : null}
        </div>
      </div>
      <label htmlFor={inputId} className={styles.visuallyHidden}>
        プロフィール画像のファイル
      </label>
      {selection.type !== "keep" ? (
        <p className={styles.note}>「更新する」を押すと反映されます。</p>
      ) : null}
      {error && sourceUrl == null ? (
        <p className={styles.error}>{error}</p>
      ) : null}

      <input
        type="hidden"
        name={PROFILE_IMAGE_ACTION_FIELD}
        value={selection.type}
      />
      {selection.type === "set" ? (
        <input
          type="hidden"
          name={PROFILE_IMAGE_ASSET_ID_FIELD}
          value={selection.assetId}
        />
      ) : null}

      <Modal
        open={sourceUrl != null}
        onClose={closeCropModal}
        title="プロフィール画像の範囲を選ぶ"
      >
        {sourceUrl ? (
          <div className={styles.modalBody}>
            <ProfileCropEditor
              imageUrl={sourceUrl}
              onChange={setCropSelection}
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.buttonRow}>
              <Button
                variant="primary"
                isDisabled={isUploading || cropSelection == null}
                onPress={confirmCrop}
              >
                {isUploading ? "アップロード中..." : "この範囲で決定する"}
              </Button>
              <Button
                variant="secondary"
                isDisabled={isUploading}
                onPress={closeCropModal}
              >
                キャンセル
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
