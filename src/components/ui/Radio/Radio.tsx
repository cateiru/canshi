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
  /** 選択肢を並べる要素に足すクラス（横並び・格子状に並べるときなど） */
  optionsClassName?: string;
  children: ReactNode;
};

export function RadioGroup({
  label,
  className,
  optionsClassName,
  children,
  ...props
}: RadioGroupProps) {
  const classes = [styles.group, className].filter(Boolean).join(" ");

  return (
    <AriaRadioGroup className={classes} {...props}>
      {label ? <Label className={styles.groupLabel}>{label}</Label> : null}
      <div
        className={[styles.options, optionsClassName].filter(Boolean).join(" ")}
      >
        {children}
      </div>
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
