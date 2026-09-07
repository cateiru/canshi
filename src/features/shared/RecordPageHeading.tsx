import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import styles from "./RecordPageHeading.module.css";

type RecordPageHeadingProps = {
  icon: IconType;
  children: ReactNode;
};

export function RecordPageHeading({
  icon: Icon,
  children,
}: RecordPageHeadingProps) {
  return (
    <h1 className={styles.heading}>
      <Icon className={styles.icon} aria-hidden="true" />
      {children}
    </h1>
  );
}
