"use client";

import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { ButtonContent, type ButtonIconProps } from "./ButtonContent";
import { type ButtonVariant, getButtonClassName } from "./buttonStyles";

export type { ButtonVariant } from "./buttonStyles";

export type ButtonProps = Omit<AriaButtonProps, "className"> &
  ButtonIconProps & {
    variant?: ButtonVariant;
    className?: string;
  };

export function Button({
  variant = "secondary",
  className,
  type = "button",
  leftIcon,
  rightIcon,
  children,
  ...props
}: ButtonProps) {
  const classes = getButtonClassName(variant, className);

  return (
    <AriaButton type={type} className={classes} {...props}>
      {typeof children === "function" ? (
        (renderProps) => (
          <ButtonContent leftIcon={leftIcon} rightIcon={rightIcon}>
            {children(renderProps)}
          </ButtonContent>
        )
      ) : (
        <ButtonContent leftIcon={leftIcon} rightIcon={rightIcon}>
          {children}
        </ButtonContent>
      )}
    </AriaButton>
  );
}
