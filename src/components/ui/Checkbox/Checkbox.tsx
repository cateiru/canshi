"use client";

import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";
import styles from "./Checkbox.module.css";

export type CheckboxProps = AriaCheckboxProps;

export function Checkbox({ className, children, ...props }: CheckboxProps) {
  const classes = [styles.checkbox, className].filter(Boolean).join(" ");

  return (
    <AriaCheckbox className={classes} {...props}>
      {(renderProps) => (
        <>
          <span className={styles.box} aria-hidden="true">
            {renderProps.isIndeterminate ? (
              <svg
                className={styles.mark}
                viewBox="0 0 12 12"
                aria-hidden="true"
                focusable="false"
              >
                <line x1="2" y1="6" x2="10" y2="6" />
              </svg>
            ) : (
              <svg
                className={styles.mark}
                viewBox="0 0 12 12"
                aria-hidden="true"
                focusable="false"
              >
                <polyline points="2,6 5,9 10,3" />
              </svg>
            )}
          </span>
          {typeof children === "function" ? children(renderProps) : children}
        </>
      )}
    </AriaCheckbox>
  );
}
