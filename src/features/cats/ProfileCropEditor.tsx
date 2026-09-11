"use client";

import { useRef } from "react";
import { Cropper, type ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import styles from "./ProfileCropEditor.module.css";
import type { ProfileCrop } from "./profileCrop";

type ProfileCropEditorProps = {
  imageUrl: string;
  value: ProfileCrop;
  onChange: (next: ProfileCrop) => void;
};

/**
 * プロフィール画像として使う正方形の表示位置を選ぶ UI。
 * 切り抜き枠は正方形に固定したまま動かせないようにし、代わりに写真の方をドラッグして
 * 好きな部分を枠に合わせてもらう（cropperjs の dragMode: "move"）。
 * 枠の一辺は object-fit: cover で表示したときに実際に見える範囲（= 短辺いっぱい）に固定する
 */
export function ProfileCropEditor({
  imageUrl,
  value,
  onChange,
}: ProfileCropEditorProps) {
  const cropperRef = useRef<ReactCropperElement>(null);

  const applyCropBoxFromValue = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) {
      return;
    }
    const { naturalWidth, naturalHeight } = cropper.getImageData();
    if (!naturalWidth || !naturalHeight) {
      return;
    }
    const side = Math.min(naturalWidth, naturalHeight);
    const maxX = naturalWidth - side;
    const maxY = naturalHeight - side;
    cropper.setData({
      x: maxX * (value.x / 100),
      y: maxY * (value.y / 100),
      width: side,
      height: side,
    });
  };

  const handleCrop = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) {
      return;
    }
    const data = cropper.getData();
    const { naturalWidth, naturalHeight } = cropper.getImageData();
    const maxX = naturalWidth - data.width;
    const maxY = naturalHeight - data.height;
    onChange({
      x: maxX <= 0 ? 50 : Math.round((data.x / maxX) * 100),
      y: maxY <= 0 ? 50 : Math.round((data.y / maxY) * 100),
    });
  };

  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>ドラッグして表示位置を調整</p>
      <Cropper
        ref={cropperRef}
        src={imageUrl}
        className={styles.cropper}
        viewMode={1}
        dragMode="move"
        aspectRatio={1}
        cropBoxMovable={false}
        cropBoxResizable={false}
        zoomable={false}
        rotatable={false}
        scalable={false}
        toggleDragModeOnDblclick={false}
        guides={false}
        center={false}
        highlight={false}
        background={false}
        autoCrop={true}
        ready={applyCropBoxFromValue}
        crop={handleCrop}
      />
    </div>
  );
}
