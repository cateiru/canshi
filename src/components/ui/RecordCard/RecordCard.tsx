import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import type { IconBaseProps } from "react-icons";
import styles from "./RecordCard.module.css";

export type RecordCardProps = HTMLAttributes<HTMLElement> & {
  /** 描画する要素。記録 1 件は article、見出し付きのまとまりは section にする */
  as?: "article" | "section" | "div";
};

/** 記録一覧の 1 件分のカード。背景・角丸・余白・コントラストを上げたときの輪郭を持つ */
export function RecordCard({
  as: Component = "article",
  className,
  ...props
}: RecordCardProps) {
  return (
    <Component
      className={[styles.card, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export type RecordEmptyStateProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  /** 中央に大きく表示するアイコン（記録の種類のアイコンなど） */
  icon?: ComponentType<IconBaseProps>;
  /** 記録がないことを伝える文 */
  children: ReactNode;
  /** 「最初の記録をする」などのボタン */
  actions?: ReactNode;
};

/** 記録がまだないときに、一覧の代わりに表示するカード */
export function RecordEmptyState({
  icon: Icon,
  children,
  actions,
  className,
  ...props
}: RecordEmptyStateProps) {
  return (
    <div
      className={[styles.card, styles.empty, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" size={32} /> : null}
      <p>{children}</p>
      {actions ? <div className={styles.emptyActions}>{actions}</div> : null}
    </div>
  );
}
