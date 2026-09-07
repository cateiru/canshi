"use client";

import {
  FieldError,
  Label,
  TextArea,
  TextField,
  type TextFieldProps,
} from "react-aria-components";
import styles from "./Textarea.module.css";

export type TextareaProps = TextFieldProps & {
  label: string;
  errorMessage?: string;
  rows?: number;
  placeholder?: string;
};

export function Textarea({
  label,
  errorMessage,
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
      {errorMessage ? (
        <FieldError className={styles.errorMessage}>{errorMessage}</FieldError>
      ) : null}
    </TextField>
  );
}
