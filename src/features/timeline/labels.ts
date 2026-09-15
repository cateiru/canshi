import type { IconType } from "react-icons";
import {
  BroomIcon,
  ExpenseIcon,
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

import type { TimelineRecordType } from "./queries";

export const TIMELINE_TYPE_LABEL: Record<TimelineRecordType, string> = {
  feeding: "ごはん",
  poop: "うんち",
  weight: "体重",
  vomit: "嘔吐",
  water: "水",
  shampoo: "シャンプー",
  cleaning: "掃除",
  symptom: "症状",
  medicationDose: "服薬",
  hospitalVisit: "通院",
  catPhoto: "写真",
  expense: "支出",
};

export const TIMELINE_TYPE_ICON = {
  feeding: FeedingIcon,
  poop: PoopIcon,
  weight: WeightIcon,
  vomit: VomitIcon,
  water: WaterIcon,
  shampoo: ShampooIcon,
  cleaning: BroomIcon,
  symptom: SymptomIcon,
  medicationDose: MedicationIcon,
  hospitalVisit: HospitalIcon,
  catPhoto: PhotoIcon,
  expense: ExpenseIcon,
} satisfies Record<TimelineRecordType, IconType>;
