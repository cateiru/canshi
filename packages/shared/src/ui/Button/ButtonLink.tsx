import {
  AnchorLink,
  type LinkComponentProps,
  type LinkProps,
} from "../Link/Link";
import { ButtonContent, type ButtonIconProps } from "./ButtonContent";
import { type ButtonVariant, getButtonClassName } from "./buttonStyles";

export type ButtonLinkProps = LinkProps &
  LinkComponentProps &
  ButtonIconProps & {
    variant?: ButtonVariant;
  };

export function ButtonLink({
  variant = "secondary",
  className,
  leftIcon,
  rightIcon,
  children,
  linkComponent: Link = AnchorLink,
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
