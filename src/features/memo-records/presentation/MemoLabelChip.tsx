import Link from "next/link";
import type { MemoLabelView } from "../domain/memoLabel";
import styles from "./MemoLabelChip.module.css";

type MemoLabelChipProps = {
  label: Pick<MemoLabelView, "name" | "color">;
};

/** メモのラベル 1 つの表示。色は点・枠・面で示し、名前は文字で出す */
export function MemoLabelChip({ label }: MemoLabelChipProps) {
  return (
    <span className={styles.chip} data-color={label.color}>
      <span className={styles.dot} aria-hidden="true" />
      {label.name}
    </span>
  );
}

type MemoLabelListProps = {
  labels: readonly MemoLabelView[];
  /** 指定すると、ラベルを、そのラベルで絞り込んだ一覧へのリンクにする */
  getHref?: (labelId: string) => string;
  className?: string;
};

/** メモに付いているラベルの並び。ラベルがなければ何も表示しない */
export function MemoLabelList({
  labels,
  getHref,
  className,
}: MemoLabelListProps) {
  if (labels.length === 0) {
    return null;
  }
  return (
    <ul
      className={[styles.list, className].filter(Boolean).join(" ")}
      aria-label="ラベル"
    >
      {labels.map((label) => (
        <li key={label.id}>
          {getHref ? (
            <Link
              href={getHref(label.id)}
              className={styles.link}
              title={`「${label.name}」のラベルで絞り込む`}
            >
              <MemoLabelChip label={label} />
            </Link>
          ) : (
            <MemoLabelChip label={label} />
          )}
        </li>
      ))}
    </ul>
  );
}
