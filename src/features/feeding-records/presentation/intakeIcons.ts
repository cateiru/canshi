import { FeedingIcon, WaterIcon } from "@canshi/shared/ui/RecordIcons";
import type { ComponentType } from "react";
import type { IconBaseProps } from "react-icons";
import type { FoodAmountUnit } from "@/db/schema/food-amount-units";

/** 推定摂取量の見出しのアイコン。g の商品は「食べた量」、ml の商品は「飲んだ量」 */
export const FEEDING_INTAKE_ICON: Record<
  FoodAmountUnit,
  ComponentType<IconBaseProps>
> = {
  g: FeedingIcon,
  ml: WaterIcon,
};
