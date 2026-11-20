"use client";

import { ListBoxItem } from "react-aria-components";
import { TbCheck } from "react-icons/tb";
import styles from "./ListBoxOption.module.css";

export type ListBoxOptionProps = {
  id: string;
  label: string;
};

/**
 * Select・ComboBox の候補 1 件。選択中の候補は背景・太字・チェックで示し、
 * ほかの候補は文字を控えめにして、どれを選んでいるかをアクセントカラーに頼らず分かるようにする
 */
export function ListBoxOption({ id, label }: ListBoxOptionProps) {
  return (
    <ListBoxItem id={id} textValue={label} className={styles.option}>
      {({ isSelected }) => (
        <>
          <span className={styles.label}>{label}</span>
          {isSelected ? (
            <TbCheck className={styles.selectedMark} aria-hidden="true" />
          ) : null}
        </>
      )}
    </ListBoxItem>
  );
}
