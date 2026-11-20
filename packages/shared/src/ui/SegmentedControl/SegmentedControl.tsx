"use client";

import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import styles from "./SegmentedControl.module.css";

export type SegmentedControlProps<T extends string> = {
  /** 選択肢の値。並び順のまま表示する */
  options: readonly T[];
  /** 選択肢ごとの表示名 */
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  /** 文字のない切り替えのため、読み上げ用のラベルを必須にする */
  "aria-label": string;
  "aria-describedby"?: string;
  /**
   * - sm: グラフの表示期間など、見出しの横に置く小さな切り替え
   * - md: 設定項目など、幅いっぱいに広げる切り替え
   */
  size?: "sm" | "md";
  className?: string;
};

/** 選択肢から 1 つを選ぶ切り替えボタン（グラフの表示期間・見た目設定など） */
export function SegmentedControl<T extends string>({
  options,
  labels,
  value,
  onChange,
  size = "md",
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <ToggleButtonGroup
      className={[styles.group, styles[size], className]
        .filter(Boolean)
        .join(" ")}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [next] = keys;
        if (next) {
          onChange(next as T);
        }
      }}
      {...props}
    >
      {options.map((option) => (
        <ToggleButton key={option} id={option} className={styles.button}>
          {labels[option]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
