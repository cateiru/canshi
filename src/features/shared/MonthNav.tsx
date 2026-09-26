import Link from "next/link";
import { TbChevronLeft, TbChevronRight } from "react-icons/tb";
import styles from "./MonthNav.module.css";

type MonthNavProps = {
  year: number;
  month: number; // 1-12
  prevHref: string;
  nextHref: string;
};

/** 「前の月」「次の月」への移動リンクと表示中の年月を並べる月切り替えナビ */
export function MonthNav({ year, month, prevHref, nextHref }: MonthNavProps) {
  return (
    <nav className={styles.monthNav} aria-label="表示する月">
      <Link href={prevHref}>
        <TbChevronLeft aria-hidden="true" size={18} />
        前の月
      </Link>
      <span className={styles.monthLabel}>
        {year}年{month}月
      </span>
      <Link href={nextHref}>
        次の月
        <TbChevronRight aria-hidden="true" size={18} />
      </Link>
    </nav>
  );
}
