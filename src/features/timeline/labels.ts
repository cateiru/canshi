import type { IconType } from "react-icons";
import { FaPoop } from "react-icons/fa";
import { PiBroomBold } from "react-icons/pi";
import { RiCapsuleFill } from "react-icons/ri";
import {
  TbBath,
  TbBuildingHospital,
  TbDroplet,
  TbMeat,
  TbPhoto,
  TbTemperature,
  TbToiletPaper,
  TbWeight,
} from "react-icons/tb";
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
};

export const TIMELINE_TYPE_ICON: Record<TimelineRecordType, IconType> = {
  feeding: TbMeat,
  poop: FaPoop,
  weight: TbWeight,
  vomit: TbToiletPaper,
  water: TbDroplet,
  shampoo: TbBath,
  cleaning: PiBroomBold,
  symptom: TbTemperature,
  medicationDose: RiCapsuleFill,
  hospitalVisit: TbBuildingHospital,
  catPhoto: TbPhoto,
};
