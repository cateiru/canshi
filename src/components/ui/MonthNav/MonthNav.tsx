import { TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { ButtonLink } from "../Button/ButtonLink";
import styles from "./MonthNav.module.css";

export type MonthNavProps = {
  year: number;
  month: number; // 1-12
  prevHref: string;
  nextHref: string;
};

/** 「前の月」「次の月」への移動リンクと表示中の年月を並べる月切り替えナビ */
export function MonthNav({ year, month, prevHref, nextHref }: MonthNavProps) {
  return (
    <nav className={styles.monthNav} aria-label="表示する月">
      <ButtonLink
        href={prevHref}
        variant="ghost"
        leftIcon={TbChevronLeft}
        className={styles.link}
      >
        前の月
      </ButtonLink>
      <span className={styles.monthLabel}>
        {year}年{month}月
      </span>
      <ButtonLink
        href={nextHref}
        variant="ghost"
        rightIcon={TbChevronRight}
        className={styles.link}
      >
        次の月
      </ButtonLink>
    </nav>
  );
}
