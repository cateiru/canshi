"use client";

import type { ReactNode } from "react";
import {
  FieldError,
  Input,
  Label,
  TextField,
  type TextFieldProps,
} from "react-aria-components";
import { FieldDescription } from "./FieldDescription";
import styles from "./FormField.module.css";

export type FormFieldProps = TextFieldProps & {
  label: string;
  errorMessage?: string;
  /** 入力欄の下に添える補足説明。読み上げでも入力欄の説明として伝わる */
  description?: ReactNode;
  placeholder?: string;
};

export function FormField({
  label,
  errorMessage,
  description,
  placeholder,
  className,
  ...props
}: FormFieldProps) {
  const classes = [styles.field, className].filter(Boolean).join(" ");

  return (
    <TextField {...props} isInvalid={!!errorMessage} className={classes}>
      <Label className={styles.label}>{label}</Label>
      <Input className={styles.input} placeholder={placeholder} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errorMessage ? (
        <FieldError className={styles.errorMessage}>{errorMessage}</FieldError>
      ) : null}
    </TextField>
  );
}
