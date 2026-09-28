import Link from "next/link";
import { TbCheck } from "react-icons/tb";
import styles from "./FilterTabs.module.css";

export type FilterTabItem = {
  key: string;
  href: string;
  label: string;
};

export type FilterTabsProps = {
  items: readonly FilterTabItem[];
  /** 選択中の項目の key */
  selectedKey: string;
  /** 何で絞り込むかを読み上げるためのラベル */
  "aria-label": string;
  className?: string;
};

/**
 * 一覧を絞り込むリンクのタブ（支出の対象・通知の猫など）。
 * 選択中の項目には aria-current="page" とチェックを付ける
 */
export function FilterTabs({
  items,
  selectedKey,
  className,
  ...props
}: FilterTabsProps) {
  return (
    <nav
      className={[styles.nav, className].filter(Boolean).join(" ")}
      {...props}
    >
      {items.map((item) => {
        const isSelected = item.key === selectedKey;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={styles.tab}
            aria-current={isSelected ? "page" : undefined}
          >
            {isSelected ? (
              <TbCheck className={styles.selectedMark} aria-hidden="true" />
            ) : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
