import { TbCat } from "react-icons/tb";
import { CatEarFrame } from "@/components/ui";
import { mediaThumbnailUrl } from "@/features/media/view";
import styles from "./CatAvatar.module.css";

type CatAvatarProps = {
  name: string;
  profileMediaAssetId: string | null;
  size?: "sm" | "lg";
};

/**
 * 猫のプロフィール画像。写真がなければ猫のアイコンを表示する
 */
export function CatAvatar({
  name,
  profileMediaAssetId,
  size = "sm",
}: CatAvatarProps) {
  return (
    <CatEarFrame className={`${styles.avatar} ${styles[size]}`}>
      {profileMediaAssetId ? (
        <img
          src={mediaThumbnailUrl(profileMediaAssetId)}
          alt={`${name}のプロフィール画像`}
          className={styles.image}
        />
      ) : (
        <span
          role="img"
          className={styles.placeholder}
          aria-label={`${name}の画像なし`}
        >
          <TbCat aria-hidden="true" />
        </span>
      )}
    </CatEarFrame>
  );
}
