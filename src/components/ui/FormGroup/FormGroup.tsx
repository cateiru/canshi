import { type FieldsetHTMLAttributes, type ReactNode, useId } from "react";
import styles from "./FormGroup.module.css";

export type FormGroupProps = Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  "disabled"
> & {
  /** まとまりの見出し（legend） */
  legend: ReactNode;
  /** まとまりの下に添える補足説明。まとまりの aria-describedby に紐付ける */
  description?: ReactNode;
  /** まとまり全体のエラー。読み上げで通知し、aria-describedby にも紐付ける */
  errorMessage?: string;
  isDisabled?: boolean;
};

/**
 * チェックボックス・ラジオの並びや、関連する入力欄のまとまり。
 * fieldset と見出し（legend）・補足説明・まとまり全体のエラーを持つ
 */
export function FormGroup({
  legend,
  description,
  errorMessage,
  isDisabled,
  className,
  children,
  ...props
}: FormGroupProps) {
  const descriptionId = useId();
  const errorId = useId();
  const describedBy = [
    description ? descriptionId : null,
    errorMessage ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <fieldset
      className={[styles.group, className].filter(Boolean).join(" ")}
      disabled={isDisabled}
      aria-describedby={describedBy || undefined}
      aria-invalid={!!errorMessage}
      {...props}
    >
      <legend className={styles.legend}>{legend}</legend>
      {children}
      {description ? (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={errorId} className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  );
}
