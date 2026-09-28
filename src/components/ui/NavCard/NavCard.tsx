import Link from "next/link";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import type { IconBaseProps } from "react-icons";
import { TbChevronRight } from "react-icons/tb";
import styles from "./NavCard.module.css";

export type NavCardProps = Omit<
  ComponentProps<typeof Link>,
  "title" | "children"
> & {
  /**
   * - row: 横長の行型。先頭のアイコン・タイトル・説明・右矢印を横に並べる（設定一覧など）
   * - tile: 縦並びのタイル型。アイコンとタイトルを中央に積む（猫詳細の記録メニュー）
   */
  layout?: "row" | "tile";
  /** 先頭のアイコン。大きさと aria-hidden はコンポーネント側で揃える */
  icon?: ComponentType<IconBaseProps>;
  /** アイコンの代わりに先頭に置く要素（猫のアバターなど） */
  avatar?: ReactNode;
  title: ReactNode;
  /** タイトルの要素。一覧の各項目を見出しにするときは h2 などを渡す */
  titleAs?: "h2" | "h3" | "span";
  description?: ReactNode;
};

/** 別のページへ移動するカード。hover・フォーカス・コントラストを上げたときの輪郭を持つ */
export function NavCard({
  layout = "row",
  icon: Icon,
  avatar,
  title,
  titleAs: Title = "span",
  description,
  className,
  ...props
}: NavCardProps) {
  return (
    <Link
      className={[styles.card, styles[layout], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {Icon ? <Icon className={styles.icon} aria-hidden="true" /> : avatar}
      <div className={styles.content}>
        <Title className={styles.title}>{title}</Title>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </div>
      {layout === "row" ? (
        <TbChevronRight className={styles.chevron} aria-hidden="true" />
      ) : null}
    </Link>
  );
}
