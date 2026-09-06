"use client";

import {
  Heading as AriaHeading,
  type HeadingProps as AriaHeadingProps,
} from "react-aria-components";
import styles from "./Heading.module.css";

export type HeadingSize = "xl" | "lg" | "md";

export type HeadingProps = AriaHeadingProps & {
  size?: HeadingSize;
};

const LEVEL_TO_SIZE: Record<number, HeadingSize> = {
  1: "xl",
  2: "lg",
  3: "md",
  4: "md",
  5: "md",
  6: "md",
};

export function Heading({
  level = 2,
  size,
  className,
  ...props
}: HeadingProps) {
  const resolvedSize = size ?? LEVEL_TO_SIZE[level] ?? "md";
  const classes = [styles.heading, styles[resolvedSize], className]
    .filter(Boolean)
    .join(" ");

  return <AriaHeading level={level} className={classes} {...props} />;
}
