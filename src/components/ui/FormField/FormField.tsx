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
        aria-invalid={errorMessage ? true : undefined}
        {...props}
      />
      {errorMessage ? (
        <span className={styles.errorMessage}>{errorMessage}</span>
      ) : null}
    </div>
  );
}
