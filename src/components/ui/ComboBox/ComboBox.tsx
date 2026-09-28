"use client";

import type { ReactNode } from "react";
import {
  ComboBox as AriaComboBox,
  type ComboBoxProps as AriaComboBoxProps,
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";
import { FieldDescription } from "../FormField/FieldDescription";
import styles from "./ComboBox.module.css";

export type ComboBoxOption = {
  value: string;
  label: string;
};

export type ComboBoxProps = Omit<
  AriaComboBoxProps<ComboBoxOption>,
  "children" | "defaultItems" | "items"
> & {
  label: string;
  errorMessage?: string;
  /** 入力欄の下に添える補足説明。読み上げでも入力欄の説明として伝わる */
  description?: ReactNode;
  placeholder?: string;
  options: ComboBoxOption[];
};

export function ComboBox({
  label,
  errorMessage,
  description,
  placeholder,
  options,
  className,
  ...props
}: ComboBoxProps) {
  const classes = [styles.field, className].filter(Boolean).join(" ");

  return (
    <AriaComboBox
      {...props}
      defaultItems={options}
      isInvalid={!!errorMessage}
      className={classes}
    >
      <Label className={styles.label}>{label}</Label>
      <div className={styles.control}>
        <Input className={styles.input} placeholder={placeholder} />
        <Button className={styles.trigger} aria-label="候補を表示">
          <svg className={styles.arrow} viewBox="0 0 10 6" aria-hidden="true">
            <polyline points="1,1 5,5 9,1" />
          </svg>
        </Button>
      </div>
      <Popover className={styles.popover}>
        <ListBox className={styles.listbox}>
          {(option: ComboBoxOption) => (
            <ListBoxItem
              id={option.value}
              textValue={option.label}
              className={styles.option}
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errorMessage ? (
        <FieldError className={styles.errorMessage}>{errorMessage}</FieldError>
      ) : null}
    </AriaComboBox>
  );
}
