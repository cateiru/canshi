import type { ReactNode } from "react";
import { TbCircle, TbX } from "react-icons/tb";
import { Table } from "@/components/ui";
import styles from "./HelpComparisonTable.module.css";

/** 星取り表の 1 つのセル。できるか（○・×）と、補足の短い説明 */
export type HelpComparisonCell = {
  available: boolean;
  note?: ReactNode;
};

export type HelpComparisonRow = {
  /** 比べる項目の名前（行の見出し） */
  label: string;
  /** `columns` と同じ順の、各列のセル */
  cells: HelpComparisonCell[];
};

type HelpComparisonTableProps = {
  /** 表の名前。スクリーンリーダー向けの caption にする */
  caption: string;
  /** 比べるもの（列の見出し） */
  columns: string[];
  rows: HelpComparisonRow[];
};

/**
 * ヘルプの本文で、いくつかのもの（記録方法など）でできることを ○・× で比べる星取り表。
 * 記号はスクリーンリーダーでは「できる」「できない」と読み上げさせる
 */
export function HelpComparisonTable({
  caption,
  columns,
  rows,
}: HelpComparisonTableProps) {
  return (
    <Table className={styles.table}>
      <caption className={styles.visuallyHidden}>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className={styles.visuallyHidden}>項目</span>
          </th>
          {columns.map((column) => (
            <th key={column} scope="col" className={styles.column}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row" className={styles.label}>
              {row.label}
            </th>
            {row.cells.map((cell, index) => (
              <td
                // 列の順は columns で決まり、並び替えない
                // biome-ignore lint/suspicious/noArrayIndexKey: 列の位置がそのままキーになる
                key={index}
                className={styles.cell}
              >
                <HelpComparisonMark available={cell.available} />
                {cell.note ? (
                  <span className={styles.note}>{cell.note}</span>
                ) : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function HelpComparisonMark({ available }: { available: boolean }) {
  const Icon = available ? TbCircle : TbX;
  return (
    <span
      className={available ? styles.available : styles.unavailable}
      role="img"
      aria-label={available ? "できる" : "できない"}
    >
      <Icon aria-hidden="true" size={20} />
    </span>
  );
}
