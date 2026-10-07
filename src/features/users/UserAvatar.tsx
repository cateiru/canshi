import { TbUser } from "react-icons/tb";
import { ImagePreview } from "@/components/ui";
import { mediaThumbnailUrl } from "@/features/media/view";
import styles from "./UserAvatar.module.css";

type UserAvatarProps = {
  className?: string;
  name: string;
  iconMediaAssetId: string | null;
  size?: "sm" | "lg";
};

/**
 * ユーザーのアイコン画像。画像がなければ人のアイコンを表示する。
 * 画像はアップロード時に正方形に切り抜き済みのため、円形に切り取って表示する
 */
export function UserAvatar({
  className,
  name,
  iconMediaAssetId,
  size = "sm",
}: UserAvatarProps) {
  return (
    <span
      className={[styles.avatar, styles[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      <ImagePreview
        src={iconMediaAssetId ? mediaThumbnailUrl(iconMediaAssetId) : null}
        alt={`${name}のアイコン`}
        className={iconMediaAssetId ? styles.image : styles.placeholder}
        fallback={<TbUser aria-hidden="true" size="60%" />}
        fallbackLabel={`${name}のアイコンなし`}
        loading="eager"
      />
    </span>
  );
}
