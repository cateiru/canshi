import type { ReactNode } from "react";
import { Text } from "react-aria-components";
import styles from "./FieldDescription.module.css";

/**
 * 入力欄の補足説明。react-aria の description スロットに入れ、
 * 入力欄の aria-describedby に自動で紐付ける
 */
export function FieldDescription({ children }: { children: ReactNode }) {
  return (
    <Text slot="description" elementType="p" className={styles.description}>
      {children}
    </Text>
  );
}
