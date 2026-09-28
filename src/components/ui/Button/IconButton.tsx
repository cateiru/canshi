"use client";

import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { getIconButtonClassName } from "./buttonStyles";
import { ICON_BUTTON_ICON_SIZE, type IconButtonIcon } from "./iconButtonIcon";

export type IconButtonProps = Omit<
  AriaButtonProps,
  "className" | "children" | "aria-label"
> & {
  icon: IconButtonIcon;
  /** 文字のないボタンのため、読み上げ用のラベルを必須にする */
  "aria-label": string;
  /**
   * hover で表示する補足。react-aria の Button は title を DOM に渡さないため、
   * 指定したときはボタンを span で包んで付ける
   */
  title?: string;
  className?: string;
};

/** 編集・削除などアイコンだけのボタン */
export function IconButton({
  icon: Icon,
  title,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  const button = (
    <AriaButton
      type={type}
      className={getIconButtonClassName(className)}
      {...props}
    >
      <Icon aria-hidden="true" size={ICON_BUTTON_ICON_SIZE} />
    </AriaButton>
  );

  return title ? <span title={title}>{button}</span> : button;
}
