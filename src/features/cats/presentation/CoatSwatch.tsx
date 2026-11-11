import type { Coat } from "../domain/coat";
import { CoatArt, swatchPalette } from "./CoatArt";
import styles from "./CoatSwatch.module.css";

export type CoatSwatchProps = {
  coat: Coat;
  /** sm: 小さな見本、md: 選択肢の色見本 */
  size?: "sm" | "md";
  className?: string;
};

/** 毛色の丸い見本。名前は隣の文字や title で伝え、装飾の見本は読み上げない */
export function CoatSwatch({ coat, size = "sm", className }: CoatSwatchProps) {
  const classes = [styles.swatch, styles[size], className]
    .filter(Boolean)
    .join(" ");

  if (!coat.coatColor) {
    return <span className={`${classes} ${styles.empty}`} aria-hidden="true" />;
  }

  return (
    <span className={classes} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
        <CoatArt palette={swatchPalette(coat.coatColor)} />
      </svg>
    </span>
  );
}
