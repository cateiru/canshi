"use client";

import { useEffect, useState } from "react";
import Cropper, { type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Slider } from "@/components/ui";
import styles from "./ProfileCropEditor.module.css";
import {
  clampCropOffset,
  clampCropRotation,
  clampCropZoom,
  MAX_PROFILE_CROP_ZOOM,
  minZoomForRotation,
  type ProfileCrop,
} from "./profileCrop";

type ProfileCropEditorProps = {
  imageUrl: string;
  value: ProfileCrop;
  onChange: (next: ProfileCrop) => void;
};

/**
 * 切り抜き枠の固定サイズ（px）。表示位置は枠のサイズに対する百分率で保存するため、
 * コンテナの実際の表示幅に関わらずこの値を基準にする
 */
const CROP_SIZE = { width: 280, height: 280 };

/**
 * プロフィール画像として使う正方形の表示位置・ズーム・回転を選ぶ UI（react-easy-crop）。
 * 枠は中央に固定し、画像をドラッグ・ピンチ／ホイール（ズーム）・2本指回転（またはスライダー）
 * で操作する。回転させると正方形の四隅に画像の外側が写り込みうるため、回転角度に応じて
 * 必要な最小ズームを都度引き上げる（`minZoomForRotation`）
 */
export function ProfileCropEditor({
  imageUrl,
  value,
  onChange,
}: ProfileCropEditorProps) {
  const [crop, setCrop] = useState<Point>({
    x: (value.x / 100) * CROP_SIZE.width,
    y: (value.y / 100) * CROP_SIZE.height,
  });
  const [zoom, setZoom] = useState(value.zoom);
  const [rotation, setRotation] = useState(value.rotation);

  const minZoom = minZoomForRotation(rotation);

  useEffect(() => {
    onChange({
      x: clampCropOffset((crop.x / CROP_SIZE.width) * 100),
      y: clampCropOffset((crop.y / CROP_SIZE.height) * 100),
      zoom: clampCropZoom(zoom),
      rotation: clampCropRotation(rotation),
    });
    // value（親の状態）は onChange 経由でこのコンポーネントから更新されるため、
    // 依存配列に含めると自分自身が発火したイベントで無限にループしてしまう
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop, zoom, rotation, onChange]);

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
        ドラッグして表示位置を調整、ピンチ／ホイールでズーム
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
          cropSize={CROP_SIZE}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={handleRotationChange}
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
