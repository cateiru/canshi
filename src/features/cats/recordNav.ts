import type { IconType } from "react-icons";
import { TbTimeline } from "react-icons/tb";
import {
  BroomIcon,
  FeedingIcon,
  HospitalIcon,
  MedicationIcon,
  PhotoIcon,
  PoopIcon,
  ShampooIcon,
  SymptomIcon,
  VomitIcon,
  WaterIcon,
  WeightIcon,
} from "@/components/ui/RecordIcons/RecordIcons";

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
    icon: FeedingIcon,
    label: "ごはん記録",
  },
  {
    href: (catId) => `/cats/${catId}/poop-records`,
    icon: PoopIcon,
    label: "うんち記録",
  },
  {
    href: (catId) => `/cats/${catId}/weight-records`,
    icon: WeightIcon,
    label: "体重記録",
  },
  {
    href: (catId) => `/cats/${catId}/vomit-records`,
    icon: VomitIcon,
    label: "嘔吐記録",
  },
  {
    href: (catId) => `/cats/${catId}/water-records`,
    icon: WaterIcon,
    label: "水の記録",
  },
  {
    href: (catId) => `/cats/${catId}/shampoo-records`,
    icon: ShampooIcon,
    label: "シャンプー記録",
  },
  {
    href: (catId) => `/cats/${catId}/cleaning`,
    icon: BroomIcon,
    label: "掃除記録",
  },
  {
    href: (catId) => `/cats/${catId}/symptoms`,
    icon: SymptomIcon,
    label: "症状記録",
  },
  {
    href: (catId) => `/cats/${catId}/medications`,
    icon: MedicationIcon,
    label: "服薬記録",
  },
  {
    href: (catId) => `/cats/${catId}/hospital-visits`,
    icon: HospitalIcon,
    label: "通院記録",
  },
  {
    href: (catId) => `/cats/${catId}/photos`,
    icon: PhotoIcon,
    label: "写真",
  },
];
