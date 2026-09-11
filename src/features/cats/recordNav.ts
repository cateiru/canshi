import type { IconType } from "react-icons";
import { FaPoop } from "react-icons/fa";
import { RiCapsuleFill } from "react-icons/ri";
import {
  TbBuildingHospital,
  TbDropletFilled,
  TbMeat,
  TbPhoto,
  TbTemperature,
  TbTimeline,
  TbToiletPaper,
  TbWeight,
} from "react-icons/tb";

export type RecordNavItem = {
  href: (catId: string) => string;
  icon: IconType;
  label: string;
};

/**
 * 猫詳細ページに表示する記録機能への導線。各記録機能の PR で追記する。
 */
export const RECORD_NAV_ITEMS: RecordNavItem[] = [
  {
    href: (catId) => `/cats/${catId}/timeline`,
    icon: TbTimeline,
    label: "タイムライン",
  },
  {
    href: (catId) => `/cats/${catId}/feeding-records`,
    icon: TbMeat,
    label: "ごはん記録",
  },
  {
    href: (catId) => `/cats/${catId}/poop-records`,
    icon: FaPoop,
    label: "うんち記録",
  },
  {
    href: (catId) => `/cats/${catId}/weight-records`,
    icon: TbWeight,
    label: "体重記録",
  },
  {
    href: (catId) => `/cats/${catId}/vomit-records`,
    icon: TbToiletPaper,
    label: "嘔吐記録",
  },
  {
    href: (catId) => `/cats/${catId}/water-records`,
    icon: TbDropletFilled,
    label: "水の記録",
  },
  {
    href: (catId) => `/cats/${catId}/symptoms`,
    icon: TbTemperature,
    label: "症状記録",
  },
  {
    href: (catId) => `/cats/${catId}/medications`,
    icon: RiCapsuleFill,
    label: "服薬記録",
  },
  {
    href: (catId) => `/cats/${catId}/hospital-visits`,
    icon: TbBuildingHospital,
    label: "通院記録",
  },
  {
    href: (catId) => `/cats/${catId}/photos`,
    icon: TbPhoto,
    label: "写真",
  },
];
