import styles from "./Button.module.css";

/**
 * - primary: 塗りつぶしの主要な操作
 * - secondary: 枠の細い補助的な操作
 * - danger: 削除などの取り消せない操作
 * - ghost: 背景や枠のない控えめな操作（月の切り替えなど）
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function getButtonClassName(variant: ButtonVariant, className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(" ");
}

export function getIconButtonClassName(className?: string) {
  return [styles.button, styles.icon, className].filter(Boolean).join(" ");
}
