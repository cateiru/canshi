import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";

import styles from "./FoodProductImage.module.css";

type FoodProductImageProps = {
  name: string;
  thumbnailUrl: string | null | undefined;
  /** sm: 選択肢・ボタン内（24px）。md: 一覧（64px） */
  size?: "sm" | "md";
};

/**
 * ごはん商品の画像。未登録ならアイコンを表示する
 */
export function FoodProductImage({
  name,
  thumbnailUrl,
  size = "md",
}: FoodProductImageProps) {
  const className = `${styles.image} ${styles[size]}`;
  if (thumbnailUrl) {
    return (
      <img src={thumbnailUrl} alt={`${name}の画像`} className={className} />
    );
  }
  return (
    <span
      role="img"
      aria-label={`${name}の画像なし`}
      className={`${className} ${styles.placeholder}`}
    >
      <FeedingIcon aria-hidden="true" />
    </span>
  );
}
