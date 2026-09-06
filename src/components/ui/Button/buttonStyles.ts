import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger";

export function getButtonClassName(variant: ButtonVariant, className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(" ");
}
