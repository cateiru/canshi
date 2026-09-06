import type { InputHTMLAttributes } from "react";
import { useId } from "react";
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
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorMessageId = `${inputId}-error`;
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
