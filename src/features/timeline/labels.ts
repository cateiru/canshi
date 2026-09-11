import type { IconType } from "react-icons";
import { FaPoop } from "react-icons/fa";
import { RiCapsuleFill } from "react-icons/ri";
import {
  TbBuildingHospital,
  TbDropletFilled,
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
  water: TbDropletFilled,
  symptom: TbTemperature,
  medicationDose: RiCapsuleFill,
  hospitalVisit: TbBuildingHospital,
  catPhoto: TbPhoto,
};
