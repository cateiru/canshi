import type { ComponentType } from "react";
import type { IconBaseProps } from "react-icons";

/** IconButton / IconButtonLink に渡すアイコン（react-icons や RecordIcons のコンポーネント） */
export type IconButtonIcon = ComponentType<IconBaseProps>;

/** Button / ButtonLink の leftIcon・rightIcon に渡すアイコン */
export type ButtonIcon = IconButtonIcon;

/** アイコンだけのボタンのアイコンの大きさ。見た目を揃えるためコンポーネント側で固定する */
export const ICON_BUTTON_ICON_SIZE = 20;

/** 文字のあるボタンの先頭・末尾に置くアイコンの大きさ */
export const BUTTON_ICON_SIZE = 18;
