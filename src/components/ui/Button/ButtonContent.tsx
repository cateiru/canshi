import type { ReactNode } from "react";
import { BUTTON_ICON_SIZE, type ButtonIcon } from "./iconButtonIcon";

export type ButtonIconProps = {
  /** 文字の前に置くアイコン。大きさと aria-hidden はコンポーネント側で揃える */
  leftIcon?: ButtonIcon;
  /** 文字の後ろに置くアイコン（「次の月 >」など） */
  rightIcon?: ButtonIcon;
};

type ButtonContentProps = ButtonIconProps & {
  children?: ReactNode;
};

/** Button / ButtonLink の中身。アイコンの大きさと読み上げの扱いを揃える */
export function ButtonContent({
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  children,
}: ButtonContentProps) {
  return (
    <>
      {LeftIcon ? (
        <LeftIcon aria-hidden="true" size={BUTTON_ICON_SIZE} />
      ) : null}
      {children}
      {RightIcon ? (
        <RightIcon aria-hidden="true" size={BUTTON_ICON_SIZE} />
      ) : null}
    </>
  );
}
