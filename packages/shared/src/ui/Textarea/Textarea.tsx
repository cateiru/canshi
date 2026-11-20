"use client";

import type { ReactNode } from "react";
import {
  FieldError,
  Label,
  TextArea,
  TextField,
  type TextFieldProps,
} from "react-aria-components";
import { FieldDescription } from "../FormField/FieldDescription";
import styles from "./Textarea.module.css";

export type TextareaProps = TextFieldProps & {
  label: string;
  errorMessage?: string;
  /** 入力欄の下に添える補足説明。読み上げでも入力欄の説明として伝わる */
  description?: ReactNode;
  rows?: number;
  placeholder?: string;
};

export function Textarea({
  label,
  errorMessage,
  description,
  className,
  rows,
  placeholder,
  ...props
}: TextareaProps) {
  const classes = [styles.field, className].filter(Boolean).join(" ");

  return (
    <TextField {...props} isInvalid={!!errorMessage} className={classes}>
      <Label className={styles.label}>{label}</Label>
      <TextArea
        className={styles.input}
        rows={rows}
        placeholder={placeholder}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errorMessage ? (
        <FieldError className={styles.errorMessage}>{errorMessage}</FieldError>
      ) : null}
    </TextField>
  );
}
