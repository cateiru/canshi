"use client";

import type { InputHTMLAttributes } from "react";
import { useId, useState } from "react";
import styles from "./FormField.module.css";

export type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  errorMessage?: string;
};

export function FormField({
  label,
  errorMessage,
  className,
  id,
  onMouseDown,
  onBlur,
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorMessageId = `${inputId}-error`;
  // input はブラウザ仕様上クリックでも :focus-visible にマッチするため、
  // ポインタ操作でフォーカスしたかを自前で判定してアウトラインを抑制する
  const [isPointerFocus, setIsPointerFocus] = useState(false);
  const ariaDescribedBy = [
    props["aria-describedby"],
    errorMessage ? errorMessageId : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const inputClasses = [styles.input, errorMessage && styles.error, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={inputClasses}
        {...props}
        onMouseDown={(event) => {
          setIsPointerFocus(true);
          onMouseDown?.(event);
        }}
        onBlur={(event) => {
          setIsPointerFocus(false);
          onBlur?.(event);
        }}
        data-focus-source={isPointerFocus ? "pointer" : undefined}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={ariaDescribedBy || undefined}
      />
      {errorMessage ? (
        <span id={errorMessageId} className={styles.errorMessage} role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
