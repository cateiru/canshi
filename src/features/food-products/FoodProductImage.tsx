import { ImagePreview } from "@/components/ui";
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
  return (
    <ImagePreview
      src={thumbnailUrl}
      alt={`${name}の画像`}
      className={[
        styles.image,
        styles[size],
        !thumbnailUrl && styles.placeholder,
      ]
        .filter(Boolean)
        .join(" ")}
      fallback={<FeedingIcon aria-hidden="true" />}
      fallbackLabel={`${name}の画像なし`}
      // 小さな画像のため、これまでどおりすぐに読み込む
      loading="eager"
    />
  );
}
