"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Slider } from "@/components/ui";
import styles from "./ProfileCropEditor.module.css";
import {
  type CropArea,
  clampCropRotation,
  MAX_PROFILE_CROP_ZOOM,
  minZoomForRotation,
} from "./profileCrop";

export type ProfileCropSelection = {
  /** 回転後のバウンディングボックス上の切り抜き範囲（px） */
  area: CropArea;
  rotation: number;
};

type ProfileCropEditorProps = {
  imageUrl: string;
  onChange: (selection: ProfileCropSelection) => void;
};

/**
 * プロフィール画像として切り抜く正方形の範囲を選ぶ UI（react-easy-crop）。
 * 枠は中央に固定し、画像をドラッグ・ピンチ／ホイール（ズーム）・2本指回転（またはスライダー）
 * で操作する。回転させると正方形の四隅に画像の外側が写り込みうるため、回転角度に応じて
 * 必要な最小ズームを都度引き上げる（`minZoomForRotation`）
 */
export function ProfileCropEditor({
  imageUrl,
  onChange,
}: ProfileCropEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const minZoom = minZoomForRotation(rotation);

  const handleZoomSliderChange = (rawZoom: number) => {
    setZoom(Math.max(minZoom, Math.min(MAX_PROFILE_CROP_ZOOM, rawZoom)));
  };

  const handleRotationChange = (rawRotation: number) => {
    const nextRotation = clampCropRotation(rawRotation);
    setRotation(nextRotation);
    // 回転で必要になる最小ズームを下回っていたら引き上げる。実際の枠位置の再計算は
    // react-easy-crop が zoom/rotation の props 変化を検知して行い、onCropChange で通知される
    setZoom((current) => Math.max(current, minZoomForRotation(nextRotation)));
  };

  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>
        ドラッグして位置を調整、ピンチ／ホイールでズーム
      </p>
      <div className={styles.cropper}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          minZoom={minZoom}
          maxZoom={MAX_PROFILE_CROP_ZOOM}
          aspect={1}
          cropShape="rect"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={handleRotationChange}
          onCropComplete={(_area: Area, areaPixels: Area) =>
            onChange({ area: areaPixels, rotation })
          }
        />
      </div>
      <div className={styles.sliders}>
        <Slider
          label="ズーム"
          minValue={minZoom}
          maxValue={MAX_PROFILE_CROP_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(next) => handleZoomSliderChange(next)}
          formatValue={(next) => `${next.toFixed(2)}倍`}
        />
        <Slider
          label="回転"
          minValue={-180}
          maxValue={180}
          step={1}
          value={rotation}
          onChange={(next) => handleRotationChange(next)}
          formatValue={(next) => `${next}°`}
        />
      </div>
    </div>
  );
}
