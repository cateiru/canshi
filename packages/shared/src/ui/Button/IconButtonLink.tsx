import {
  AnchorLink,
  type LinkComponentProps,
  type LinkProps,
} from "../Link/Link";
import { ScaledIcon } from "../ScaledIcon/ScaledIcon";
import { getIconButtonClassName } from "./buttonStyles";
import { ICON_BUTTON_ICON_SIZE, type IconButtonIcon } from "./iconButtonIcon";

export type IconButtonLinkProps = Omit<LinkProps, "aria-label"> &
  LinkComponentProps & {
    icon: IconButtonIcon;
    /** 文字のないリンクのため、読み上げ用のラベルを必須にする */
    "aria-label": string;
  };

/**
 * 編集ページへのリンクなど、アイコンだけのボタン型のリンク。
 * children はアイコンの後ろに描画する（未読件数のバッジを重ねるときなど）
 */
export function IconButtonLink({
  icon: Icon,
  className,
  children,
  linkComponent: Link = AnchorLink,
  ...props
}: IconButtonLinkProps) {
  return (
    <Link className={getIconButtonClassName(className)} {...props}>
      <ScaledIcon icon={Icon} aria-hidden="true" size={ICON_BUTTON_ICON_SIZE} />
      {children}
    </Link>
  );
}
