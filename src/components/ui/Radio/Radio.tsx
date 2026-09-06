"use client";

import type { ReactNode } from "react";
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
  Label,
} from "react-aria-components";
import styles from "./Radio.module.css";

export type RadioGroupProps = Omit<AriaRadioGroupProps, "children"> & {
  label?: string;
  children: ReactNode;
};

export function RadioGroup({
  label,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const classes = [styles.group, className].filter(Boolean).join(" ");

  return (
    <AriaRadioGroup className={classes} {...props}>
      {label ? <Label className={styles.groupLabel}>{label}</Label> : null}
      <div className={styles.options}>{children}</div>
    </AriaRadioGroup>
  );
}

export type RadioProps = Omit<AriaRadioProps, "children"> & {
  children: ReactNode;
};

export function Radio({ className, children, ...props }: RadioProps) {
  const classes = [styles.radio, className].filter(Boolean).join(" ");

  return (
    <AriaRadio className={classes} {...props}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </AriaRadio>
  );
}
