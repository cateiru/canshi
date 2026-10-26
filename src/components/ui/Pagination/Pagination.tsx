import { TbChevronLeft, TbChevronRight } from "react-icons/tb";
import { ButtonLink } from "../Button/ButtonLink";
import styles from "./Pagination.module.css";

export type PaginationProps = {
  page: number;
  totalPages: number;
  /** 指定したページへのリンク先を返す */
  getHref: (page: number) => string;
};

/**
 * 「前のページ」「次のページ」への移動リンクと現在のページ番号を並べるナビ。
 * 1ページに収まる場合は何も表示しない。
 */
export function Pagination({ page, totalPages, getHref }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className={styles.pagination} aria-label="ページ">
      <span className={styles.slot}>
        {page > 1 ? (
          <ButtonLink
            href={getHref(page - 1)}
            variant="ghost"
            leftIcon={TbChevronLeft}
            className={styles.link}
          >
            前のページ
          </ButtonLink>
        ) : null}
      </span>
      <span className={styles.pageLabel} aria-current="page">
        {page} / {totalPages}
      </span>
      <span className={styles.slot}>
        {page < totalPages ? (
          <ButtonLink
            href={getHref(page + 1)}
            variant="ghost"
            rightIcon={TbChevronRight}
            className={styles.link}
          >
            次のページ
          </ButtonLink>
        ) : null}
      </span>
    </nav>
  );
}
