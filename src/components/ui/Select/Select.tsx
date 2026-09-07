"use client";

import {
  Select as AriaSelect,
  type SelectProps as AriaSelectProps,
  Button,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";
import styles from "./Select.module.css";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = Omit<AriaSelectProps<SelectOption>, "children"> & {
  label: string;
  errorMessage?: string;
  options: SelectOption[];
};

export function Select({
  label,
  errorMessage,
  options,
  className,
  ...props
}: SelectProps) {
  const classes = [styles.field, className].filter(Boolean).join(" ");

  return (
    <AriaSelect {...props} isInvalid={!!errorMessage} className={classes}>
      <Label className={styles.label}>{label}</Label>
      <Button className={styles.trigger}>
        <SelectValue className={styles.value} />
        <svg className={styles.arrow} viewBox="0 0 10 6" aria-hidden="true">
          <polyline points="1,1 5,5 9,1" />
        </svg>
      </Button>
      <Popover className={styles.popover}>
        <ListBox items={options} className={styles.listbox}>
          {(option) => (
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
      {errorMessage ? (
        <FieldError className={styles.errorMessage}>{errorMessage}</FieldError>
      ) : null}
    </AriaSelect>
  );
}
