"use client";

import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { cropProfileImage } from "@/features/cats/cropProfileImage";
import {
  ProfileCropEditor,
  type ProfileCropSelection,
} from "@/features/cats/ProfileCropEditor";
import styles from "./SquareImageCropModal.module.css";

type SquareImageCropModalProps = {
  /** 切り抜く元の画像。null のときはモーダルを閉じる */
  file: File | null;
  title: string;
  onClose: () => void;
  /** 正方形に切り抜いた JPEG（ファイル名は元の名前の拡張子を .jpg にしたもの） */
  onCropped: (file: File) => void;
};

/** 元のファイル名の拡張子を .jpg に変える（添付のプレビューの代替テキストなどに使われるため） */
function toJpegFileName(name: string) {
  const base = name.replace(/\.[^.]*$/, "");
  return `${base || "image"}.jpg`;
}

/**
 * 選んだ画像を正方形に切り抜くモーダル。プロフィール画像と同じ切り抜き UI（`ProfileCropEditor`）を使い、
 * 決定するとブラウザで切り抜いた JPEG を返す（アップロードは呼び出し側が行う）
 */
export function SquareImageCropModal({
  file,
  title,
  onClose,
  onCropped,
}: SquareImageCropModalProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [cropSelection, setCropSelection] =
    useState<ProfileCropSelection | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCropSelection(null);
    setError(null);
    if (!file) {
      setSourceUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const close = () => {
    if (!isCropping) {
      onClose();
    }
  };

  const confirmCrop = async () => {
    if (!file || !sourceUrl || !cropSelection) {
      return;
    }
    setIsCropping(true);
    setError(null);
    try {
      const cropped = await cropProfileImage(
        sourceUrl,
        cropSelection.area,
        cropSelection.rotation,
        toJpegFileName(file.name),
      );
      onCropped(cropped);
    } catch (cropError) {
      setError(
        cropError instanceof Error
          ? cropError.message
          : "画像の切り抜きに失敗しました",
      );
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <Modal open={file != null} onClose={close} title={title}>
      {sourceUrl ? (
        <div className={styles.body}>
          <ProfileCropEditor imageUrl={sourceUrl} onChange={setCropSelection} />
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.buttonRow}>
            <Button
              variant="primary"
              isDisabled={isCropping || cropSelection == null}
              onPress={confirmCrop}
            >
              {isCropping ? "切り抜き中..." : "この範囲で決定する"}
            </Button>
            <Button variant="secondary" isDisabled={isCropping} onPress={close}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
