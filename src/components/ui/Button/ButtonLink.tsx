import Link from "next/link";
import type { ComponentProps } from "react";
import { ButtonContent, type ButtonIconProps } from "./ButtonContent";
import { type ButtonVariant, getButtonClassName } from "./buttonStyles";

export type ButtonLinkProps = ComponentProps<typeof Link> &
  ButtonIconProps & {
    variant?: ButtonVariant;
  };

export function ButtonLink({
  variant = "secondary",
  className,
  leftIcon,
  rightIcon,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={getButtonClassName(variant, className)} {...props}>
      <ButtonContent leftIcon={leftIcon} rightIcon={rightIcon}>
        {children}
      </ButtonContent>
    </Link>
  );
}
