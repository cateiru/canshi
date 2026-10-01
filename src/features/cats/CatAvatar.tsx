import { CatEarFrame, ImagePreview } from "@/components/ui";
import { mediaThumbnailUrl } from "@/features/media/view";
import styles from "./CatAvatar.module.css";
import { CatIcon } from "./CatIcon";

type CatAvatarProps = {
  className?: string;
  name: string;
  profileMediaAssetId: string | null;
  size?: "sm" | "lg";
};

/**
 * 猫のプロフィール画像。写真がなければ猫のアイコンを表示する。
 * 画像はアップロード時に正方形に切り抜き済みのため、そのまま表示する
 */
export function CatAvatar({
  className,
  name,
  profileMediaAssetId,
  size = "sm",
}: CatAvatarProps) {
  return (
    <CatEarFrame
      className={[styles.avatar, styles[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      <ImagePreview
        src={
          profileMediaAssetId ? mediaThumbnailUrl(profileMediaAssetId) : null
        }
        alt={`${name}のプロフィール画像`}
        className={profileMediaAssetId ? styles.image : styles.placeholder}
        fallback={<CatIcon aria-hidden="true" size="70%" />}
        fallbackLabel={`${name}の画像なし`}
        // 一覧の先頭に表示されることが多いため、これまでどおりすぐに読み込む
        loading="eager"
      />
    </CatEarFrame>
  );
}
