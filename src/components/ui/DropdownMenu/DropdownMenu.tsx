"use client";

import { useRouter } from "next/navigation";
import {
  Button as AriaButton,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  RouterProvider,
} from "react-aria-components";
import { TbChevronDown } from "react-icons/tb";
import { ButtonContent } from "../Button/ButtonContent";
import { type ButtonVariant, getButtonClassName } from "../Button/buttonStyles";
import { BUTTON_ICON_SIZE, type ButtonIcon } from "../Button/iconButtonIcon";
import styles from "./DropdownMenu.module.css";

export type DropdownMenuItem = {
  id: string;
  label: string;
  /** 選んだときに移動するページ */
  href: string;
  icon?: ButtonIcon;
};

export type DropdownMenuProps = {
  /** メニューを開くボタンの文字 */
  label: string;
  items: DropdownMenuItem[];
  variant?: ButtonVariant;
  leftIcon?: ButtonIcon;
  className?: string;
};

/** ボタンを押すと、移動先の候補をメニューで開く */
export function DropdownMenu({
  label,
  items,
  variant = "secondary",
  leftIcon,
  className,
}: DropdownMenuProps) {
  const router = useRouter();

  return (
    // メニュー項目の href を全体の読み込みではなく Next.js のページ遷移で開く
    <RouterProvider navigate={router.push}>
      <MenuTrigger>
        <AriaButton className={getButtonClassName(variant, className)}>
          <ButtonContent leftIcon={leftIcon} rightIcon={TbChevronDown}>
            {label}
          </ButtonContent>
        </AriaButton>
        <Popover placement="bottom end" className={styles.popover}>
          <Menu items={items} className={styles.menu}>
            {(item) => (
              <MenuItem
                id={item.id}
                href={item.href}
                textValue={item.label}
                className={styles.item}
              >
                {item.icon ? (
                  <item.icon aria-hidden="true" size={BUTTON_ICON_SIZE} />
                ) : null}
                {item.label}
              </MenuItem>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
    </RouterProvider>
  );
}
