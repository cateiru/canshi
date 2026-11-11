import { useId } from "react";
import type { Coat } from "../domain/coat";
import { CoatArt, swatchPalette } from "./CoatArt";
import styles from "./CoatSwatch.module.css";

export type CoatSwatchProps = {
  coat: Coat;
  /** sm: 小さな見本、md: 選択肢の色見本、lg: 選んだ組み合わせの見本 */
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** 毛色・柄の丸い見本。名前は隣の文字で伝え、装飾の見本は読み上げない */
export function CoatSwatch({ coat, size = "sm", className }: CoatSwatchProps) {
  const pointGradientId = useId();
  const classes = [styles.swatch, styles[size], className]
    .filter(Boolean)
    .join(" ");
  const { coatColor, coatPattern, coatWhite } = coat;

  if (!coatColor && !coatPattern && !coatWhite) {
    return <span className={`${classes} ${styles.empty}`} aria-hidden="true" />;
  }

  return (
    <span className={classes} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
        <CoatArt
          coat={coat}
          palette={swatchPalette(coatColor)}
          pointGradientId={pointGradientId}
        />
      </svg>
    </span>
  );
}
