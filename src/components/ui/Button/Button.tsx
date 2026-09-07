"use client";

import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { type ButtonVariant, getButtonClassName } from "./buttonStyles";

export type { ButtonVariant } from "./buttonStyles";

export type ButtonProps = Omit<AriaButtonProps, "className"> & {
  variant?: ButtonVariant;
  className?: string;
};

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = getButtonClassName(variant, className);

  return <AriaButton type={type} className={classes} {...props} />;
}
