import { CatEarFrame } from "@/components/ui";
import { mediaThumbnailUrl } from "@/features/media/view";
import styles from "./CatAvatar.module.css";
import { CatIcon } from "./CatIcon";

type CatAvatarProps = {
  className?: string;
  name: string;
  profileMediaAssetId: string | null;
  /** 表示位置。枠のサイズに対する百分率のオフセット（0 が中央） */
  profileCropX?: number | null;
  profileCropY?: number | null;
  /** ズーム倍率（1 以上）。未指定なら 1（ズームなし） */
  profileCropZoom?: number | null;
  /** 回転角度（度）。未指定なら 0 */
  profileCropRotation?: number | null;
  size?: "sm" | "lg";
};

/**
 * 猫のプロフィール画像。写真がなければ猫のアイコンを表示する。
 * 表示位置・ズーム・回転は ProfileCropEditor で選んだ値を CSS transform で再現する
 * （枠の中心を基準に、画像を平行移動 → 回転 → 拡大の順で描画。react-easy-crop の
 * デフォルトの描画式 `translate(x,y) rotate(deg) scale(z)` と同じ考え方）
 */
export function CatAvatar({
  className,
  name,
  profileMediaAssetId,
  profileCropX,
  profileCropY,
  profileCropZoom,
  profileCropRotation,
  size = "sm",
}: CatAvatarProps) {
  return (
    <CatEarFrame
      className={[styles.avatar, styles[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      {profileMediaAssetId ? (
        <img
          src={mediaThumbnailUrl(profileMediaAssetId)}
          alt={`${name}のプロフィール画像`}
          className={styles.image}
          style={{
            transform: `translate(${profileCropX ?? 0}%, ${profileCropY ?? 0}%) rotate(${profileCropRotation ?? 0}deg) scale(${profileCropZoom ?? 1})`,
          }}
        />
      ) : (
        <span
          role="img"
          className={styles.placeholder}
          aria-label={`${name}の画像なし`}
        >
          <CatIcon aria-hidden="true" size="70%" />
        </span>
      )}
    </CatEarFrame>
  );
}
