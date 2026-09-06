import Link from "next/link";
import type { ComponentProps } from "react";
import { type ButtonVariant, getButtonClassName } from "./Button";

export type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
};

export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={getButtonClassName(variant, className)} {...props} />;
}
