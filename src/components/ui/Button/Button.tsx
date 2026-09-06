import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function getButtonClassName(variant: ButtonVariant, className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(" ");
}

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = getButtonClassName(variant, className);

  return <button type={type} className={classes} {...props} />;
}
