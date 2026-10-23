import type { TableHTMLAttributes, TdHTMLAttributes } from "react";
import styles from "./Table.module.css";

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

/**
 * 行を罫線で区切る表。狭い画面で列が収まらないときは、ページではなく表だけを横にスクロールさせる。
 * 見出しのセルは `thead` の `th`、各行の見出しは `th scope="row"` で書く
 */
export function Table({ className, ...props }: TableProps) {
  const classes = [styles.table, className].filter(Boolean).join(" ");

  return (
    <div className={styles.scroll}>
      <table className={classes} {...props} />
    </div>
  );
}

export type TableActionCellProps = TdHTMLAttributes<HTMLTableCellElement>;

/**
 * ボタンなどの操作を右寄せで置くセル。操作がない行でもボタンと同じ高さを確保し、
 * 行によって高さが変わらないようにする
 */
export function TableActionCell({
  className,
  children,
  ...props
}: TableActionCellProps) {
  const classes = [styles.actionCell, className].filter(Boolean).join(" ");

  return (
    <td className={classes} {...props}>
      <div className={styles.actions}>{children}</div>
    </td>
  );
}
