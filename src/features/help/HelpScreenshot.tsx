import styles from "./HelpScreenshot.module.css";
import {
  HELP_SCREENSHOT_VIEWPORT,
  type HelpScreenshotName,
  helpScreenshotSrc,
} from "./screenshots";

type HelpScreenshotProps = {
  name: HelpScreenshotName;
  /** 画像に写っている内容。画面の読み上げで使う */
  alt: string;
  caption?: string;
};

/** スマートフォンの画面のスクリーンショット。端末の枠に収めて、説明文と並べやすい幅で表示する */
export function HelpScreenshot({ name, alt, caption }: HelpScreenshotProps) {
  return (
    <figure className={styles.figure}>
      <img
        src={helpScreenshotSrc(name)}
        alt={alt}
        width={HELP_SCREENSHOT_VIEWPORT.width}
        height={HELP_SCREENSHOT_VIEWPORT.height}
        loading="lazy"
        decoding="async"
        className={styles.image}
      />
      {caption ? (
        <figcaption className={styles.caption}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}
