import type { HTMLAttributes } from "react";
import styles from "./FormRow.module.css";

export type FormRowProps = HTMLAttributes<HTMLDivElement>;

/** 日付と時刻など、関連する入力欄を 2 列に並べるレイアウト */
export function FormRow({ className, ...props }: FormRowProps) {
  return (
    <div
      className={[styles.row, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
