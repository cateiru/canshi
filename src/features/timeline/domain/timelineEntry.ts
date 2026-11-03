import type {
  BrushingRecord,
  CleaningRecord,
  ExpenseRecord,
  FeedingMode,
  GivenAmountLevel,
  HospitalVisit,
  LeftoverLevel,
  MedicationDose,
  MemoRecord,
  PoopRecord,
  ShampooRecord,
  Symptom,
  VomitRecord,
  WaterRecord,
  WeightRecord,
} from "@/db/schema";
import type { MediaAssetView } from "@/features/media/domain/view";
import type {
  TimelineAdoptionRecord,
  TimelineBirthdayRecord,
} from "./anniversaries";

/*
 * タイムラインのエントリ（読み取りのモデル）。猫の記録と記念日を、発生日時の順に並べて表示する
 */

/**
 * 記録ではなく、猫の生年月日・お迎え日から求める記念日の種別。
 * カレンダーの1日のアイコンは表示数に上限があるため、記録より先に並べて必ず見えるようにする
 */
export const TIMELINE_ANNIVERSARY_TYPES = ["birthday", "adoption"] as const;

export type TimelineAnniversaryType =
  (typeof TIMELINE_ANNIVERSARY_TYPES)[number];

export const TIMELINE_RECORD_TYPES = [
  ...TIMELINE_ANNIVERSARY_TYPES,
  "feeding",
  "poop",
  "weight",
  "vomit",
  "water",
  "shampoo",
  "brushing",
  "cleaning",
  "symptom",
  "medicationDose",
  "hospitalVisit",
  "expense",
  "memo",
] as const;

export type TimelineRecordType = (typeof TIMELINE_RECORD_TYPES)[number];

export function isTimelineAnniversaryType(
  type: TimelineRecordType,
): type is TimelineAnniversaryType {
  return (TIMELINE_ANNIVERSARY_TYPES as readonly string[]).includes(type);
}

type TimelineEntryOf<T extends TimelineRecordType, R> = {
  id: string;
  type: T;
  occurredAt: Date;
  record: R;
  /** エントリに紐付く写真・動画（添付に対応していない種別は常に空） */
  media: MediaAssetView[];
};

export type TimelineFeedingItem = {
  id: string;
  foodProductId: string;
  foodProductName: string;
  /** グラム単位の量・推定値。あいまいモードの記録では null */
  givenAmountG: number | null;
  leftoverAmountG: number | null;
  estimatedIntakeG: number | null;
  estimatedKcal: number | null;
  /** 段階での量。厳格モードの記録では null */
  givenAmountLevel: GivenAmountLevel | null;
  leftoverLevel: LeftoverLevel | null;
};

export type TimelineFeedingRecord = {
  id: string;
  catId: string;
  occurredAt: Date;
  mode: FeedingMode;
  items: TimelineFeedingItem[];
};

export type TimelineEntry =
  | TimelineEntryOf<"birthday", TimelineBirthdayRecord>
  | TimelineEntryOf<"adoption", TimelineAdoptionRecord>
  | TimelineEntryOf<"feeding", TimelineFeedingRecord>
  | TimelineEntryOf<"poop", PoopRecord>
  | TimelineEntryOf<"weight", WeightRecord>
  | TimelineEntryOf<"vomit", VomitRecord>
  | TimelineEntryOf<"water", WaterRecord>
  | TimelineEntryOf<"shampoo", ShampooRecord>
  | TimelineEntryOf<"brushing", BrushingRecord>
  | TimelineEntryOf<"cleaning", CleaningRecord & { cleaningTargetName: string }>
  | TimelineEntryOf<"symptom", Symptom>
  | TimelineEntryOf<
      "medicationDose",
      MedicationDose & { medicationName: string }
    >
  | TimelineEntryOf<"hospitalVisit", HospitalVisit>
  | TimelineEntryOf<"expense", ExpenseRecord>
  | TimelineEntryOf<"memo", MemoRecord & { recordedAt: Date }>;
