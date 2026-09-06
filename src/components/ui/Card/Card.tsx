import type { HTMLAttributes, ReactNode } from "react";
import { CatEarFrame } from "../CatEarFrame/CatEarFrame";
import styles from "./Card.module.css";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
};

export function Card({ title, className, children, ...props }: CardProps) {
  const classes = className ? `${styles.card} ${className}` : styles.card;

  return (
    <CatEarFrame className={classes} {...props}>
      {title ? <div className={styles.title}>{title}</div> : null}
      {children}
    </CatEarFrame>
  );
}
