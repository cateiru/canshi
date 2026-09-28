import type { HTMLAttributes, ReactNode } from "react";
import { Heading, type HeadingSize } from "@/components/ui";
import styles from "./Surface.module.css";

type SurfaceProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title?: ReactNode;
  /** 見出しの前に置くアイコン（aria-hidden を付けて渡す） */
  icon?: ReactNode;
  /** 見出しの大きさ（既定は md） */
  titleSize?: Exclude<HeadingSize, "xl">;
  /** 見出しの id。指定すると section の aria-labelledby に使い、まとまりに名前を付ける */
  titleId?: string;
  /**
   * 見出しと中身を縦に並べる間隔。フォームの入力欄など、中身を一定の間隔で並べたいときに指定する。
   * 省略すると中身はそのまま流し込む
   */
  gap?: "sm" | "md";
};

/** 見出し付きのまとまり（面）。フォームの「基本情報」などにも使う */
export function Surface({
  title,
  icon,
  titleSize = "md",
  titleId,
  gap,
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <section
      className={[styles.surface, gap && styles[`gap-${gap}`], className]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
      {...props}
    >
      {title ? (
        <Heading
          level={2}
          size={titleSize}
          id={titleId}
          className={[styles.title, icon && styles.titleWithIcon]
            .filter(Boolean)
            .join(" ")}
        >
          {icon}
          {title}
        </Heading>
      ) : null}
      {children}
    </section>
  );
}
