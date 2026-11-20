import type { HTMLAttributes, ReactNode } from "react";
import { CatEarFrame } from "../CatEarFrame/CatEarFrame";
import { Heading } from "../Heading/Heading";
import styles from "./Card.module.css";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
};

export function Card({ title, className, children, ...props }: CardProps) {
  const classes = className ? `${styles.card} ${className}` : styles.card;

  return (
    <CatEarFrame className={classes} {...props}>
      {title ? (
        <Heading level={2} size="md" className={styles.title}>
          {title}
        </Heading>
      ) : null}
      {children}
    </CatEarFrame>
  );
}
