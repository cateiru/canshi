import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  type CatPhoto,
  type CleaningRecord,
  catPhotos,
  cleaningRecords,
  cleaningTargets,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  type HospitalVisit,
  hospitalVisits,
  type MedicationDose,
  medicationDoses,
  medications,
  type PoopRecord,
  poopRecords,
  type ShampooRecord,
  type Symptom,
  shampooRecords,
  symptoms,
  type VomitRecord,
  vomitRecords,
  type WaterRecord,
  type WeightRecord,
  waterRecords,
  weightRecords,
} from "@/db/schema";
import { CAT_PHOTO_MEDIA_TYPE } from "@/features/cat-photos/media";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "@/features/hospital-visits/media";
import {
  listMediaAssetsForRecords,
  mediaRecordKey,
} from "@/features/media/queries";
import type { MediaRecordType } from "@/features/media/recordTypes";
import { type MediaAssetView, toMediaAssetView } from "@/features/media/view";
import { POOP_RECORD_MEDIA_TYPE } from "@/features/poop-records/media";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { SYMPTOM_MEDIA_TYPE } from "@/features/symptoms/media";
import { VOMIT_RECORD_MEDIA_TYPE } from "@/features/vomit-records/media";

export const TIMELINE_RECORD_TYPES = [
  "feeding",
  "poop",
  "weight",
  "vomit",
  "water",
  "shampoo",
  "cleaning",
  "symptom",
  "medicationDose",
  "hospitalVisit",
  "catPhoto",
] as const;

export type TimelineRecordType = (typeof TIMELINE_RECORD_TYPES)[number];

/**
 * タイムラインの記録種別と media_assets.record_type の対応。
 * 添付に対応した記録種別をここに追加すると、その種別のエントリにサムネイルが表示される
 */
const TIMELINE_MEDIA_RECORD_TYPES: Partial<
  Record<TimelineRecordType, MediaRecordType>
> = {
  poop: POOP_RECORD_MEDIA_TYPE,
  vomit: VOMIT_RECORD_MEDIA_TYPE,
  symptom: SYMPTOM_MEDIA_TYPE,
  // 服薬は予定（medications）に添付するため、投薬実績（medicationDose）のエントリには表示しない
  hospitalVisit: HOSPITAL_VISIT_MEDIA_TYPE,
  catPhoto: CAT_PHOTO_MEDIA_TYPE,
};

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
  givenAmountG: number;
  leftoverAmountG: number;
  estimatedIntakeG: number;
  estimatedKcal: number;
};

export type TimelineFeedingRecord = {
  id: string;
  catId: string;
  occurredAt: Date;
  items: TimelineFeedingItem[];
};

export type TimelineEntry =
  | TimelineEntryOf<"feeding", TimelineFeedingRecord>
  | TimelineEntryOf<"poop", PoopRecord>
  | TimelineEntryOf<"weight", WeightRecord>
  | TimelineEntryOf<"vomit", VomitRecord>
  | TimelineEntryOf<"water", WaterRecord>
  | TimelineEntryOf<"shampoo", ShampooRecord>
  | TimelineEntryOf<"cleaning", CleaningRecord & { cleaningTargetName: string }>
  | TimelineEntryOf<"symptom", Symptom>
  | TimelineEntryOf<
      "medicationDose",
      MedicationDose & { medicationName: string }
    >
  | TimelineEntryOf<"hospitalVisit", HospitalVisit>
  | TimelineEntryOf<"catPhoto", CatPhoto>;

type DateRange = { start: Date; end: Date };

async function fetchFeedingEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const headers = await db
    .select({
      id: feedingRecords.id,
      catId: feedingRecords.catId,
      occurredAt: feedingRecords.occurredAt,
    })
    .from(feedingRecords)
    .where(
      and(
        eq(feedingRecords.catId, catId),
        gte(feedingRecords.occurredAt, range.start),
        lt(feedingRecords.occurredAt, range.end),
      ),
    )
    .orderBy(desc(feedingRecords.occurredAt));

  if (headers.length === 0) {
    return [];
  }

  const itemRows = await db
    .select({
      id: feedingRecordItems.id,
      feedingRecordId: feedingRecordItems.feedingRecordId,
      foodProductId: feedingRecordItems.foodProductId,
      foodProductName: foodProducts.name,
      givenAmountG: feedingRecordItems.givenAmountG,
      leftoverAmountG: feedingRecordItems.leftoverAmountG,
      estimatedIntakeG: feedingRecordItems.estimatedIntakeG,
      estimatedKcal: feedingRecordItems.estimatedKcal,
    })
    .from(feedingRecordItems)
    .innerJoin(
      foodProducts,
      eq(feedingRecordItems.foodProductId, foodProducts.id),
    )
    .where(
      inArray(
        feedingRecordItems.feedingRecordId,
        headers.map((header) => header.id),
      ),
    )
    .orderBy(feedingRecordItems.sortOrder);

  const itemsByRecordId = new Map<string, TimelineFeedingItem[]>();
  for (const row of itemRows) {
    const list = itemsByRecordId.get(row.feedingRecordId) ?? [];
    list.push({
      id: row.id,
      foodProductId: row.foodProductId,
      foodProductName: row.foodProductName,
      givenAmountG: row.givenAmountG,
      leftoverAmountG: row.leftoverAmountG,
      estimatedIntakeG: row.estimatedIntakeG,
      estimatedKcal: row.estimatedKcal,
    });
    itemsByRecordId.set(row.feedingRecordId, list);
  }

  return headers.map((header) => ({
    id: header.id,
    type: "feeding",
    occurredAt: header.occurredAt,
    media: [],
    record: {
      ...header,
      items: itemsByRecordId.get(header.id) ?? [],
    },
  }));
}

async function fetchPoopEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(poopRecords)
    .where(
      and(
        eq(poopRecords.catId, catId),
        gte(poopRecords.occurredAt, range.start),
        lt(poopRecords.occurredAt, range.end),
      ),
    )
    .orderBy(desc(poopRecords.occurredAt));

  return rows.map((record) => ({
    id: record.id,
    type: "poop",
    occurredAt: record.occurredAt,
    media: [],
    record,
  }));
}

async function fetchWeightEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(weightRecords)
    .where(
      and(
        eq(weightRecords.catId, catId),
        gte(weightRecords.occurredAt, range.start),
        lt(weightRecords.occurredAt, range.end),
      ),
    )
    .orderBy(desc(weightRecords.occurredAt));

  return rows.map((record) => ({
    id: record.id,
    type: "weight",
    occurredAt: record.occurredAt,
    media: [],
    record,
  }));
}

async function fetchVomitEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(vomitRecords)
    .where(
      and(
        eq(vomitRecords.catId, catId),
        gte(vomitRecords.occurredAt, range.start),
        lt(vomitRecords.occurredAt, range.end),
      ),
    )
    .orderBy(desc(vomitRecords.occurredAt));

  return rows.map((record) => ({
    id: record.id,
    type: "vomit",
    occurredAt: record.occurredAt,
    media: [],
    record,
  }));
}

async function fetchWaterEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(waterRecords)
    .where(
      and(
        eq(waterRecords.catId, catId),
        gte(waterRecords.occurredAt, range.start),
        lt(waterRecords.occurredAt, range.end),
      ),
    )
    .orderBy(desc(waterRecords.occurredAt));

  return rows.map((record) => ({
    id: record.id,
    type: "water",
    occurredAt: record.occurredAt,
    media: [],
    record,
  }));
}

async function fetchShampooEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(shampooRecords)
    .where(
      and(
        eq(shampooRecords.catId, catId),
        gte(shampooRecords.performedAt, range.start),
        lt(shampooRecords.performedAt, range.end),
      ),
    )
    .orderBy(desc(shampooRecords.performedAt));

  return rows.map((record) => ({
    id: record.id,
    type: "shampoo",
    occurredAt: record.performedAt,
    media: [],
    record,
  }));
}

async function fetchCleaningEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: cleaningRecords.id,
      catId: cleaningRecords.catId,
      cleaningTargetId: cleaningRecords.cleaningTargetId,
      cleaningTargetName: cleaningTargets.name,
      performedAt: cleaningRecords.performedAt,
      memo: cleaningRecords.memo,
      createdAt: cleaningRecords.createdAt,
      updatedAt: cleaningRecords.updatedAt,
    })
    .from(cleaningRecords)
    .innerJoin(
      cleaningTargets,
      eq(cleaningRecords.cleaningTargetId, cleaningTargets.id),
    )
    .where(
      and(
        eq(cleaningRecords.catId, catId),
        gte(cleaningRecords.performedAt, range.start),
        lt(cleaningRecords.performedAt, range.end),
      ),
    )
    .orderBy(desc(cleaningRecords.performedAt));

  return rows.map((record) => ({
    id: record.id,
    type: "cleaning",
    occurredAt: record.performedAt,
    media: [],
    record,
  }));
}

async function fetchSymptomEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(symptoms)
    .where(
      and(
        eq(symptoms.catId, catId),
        gte(symptoms.onsetAt, range.start),
        lt(symptoms.onsetAt, range.end),
      ),
    )
    .orderBy(desc(symptoms.onsetAt));

  return rows.map((record) => ({
    id: record.id,
    type: "symptom",
    occurredAt: record.onsetAt,
    media: [],
    record,
  }));
}

async function fetchMedicationDoseEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: medicationDoses.id,
      catId: medicationDoses.catId,
      medicationId: medicationDoses.medicationId,
      medicationName: medications.name,
      occurredAt: medicationDoses.occurredAt,
      wasAdministered: medicationDoses.wasAdministered,
      memo: medicationDoses.memo,
      createdAt: medicationDoses.createdAt,
      updatedAt: medicationDoses.updatedAt,
    })
    .from(medicationDoses)
    .innerJoin(medications, eq(medicationDoses.medicationId, medications.id))
    .where(
      and(
        eq(medicationDoses.catId, catId),
        gte(medicationDoses.occurredAt, range.start),
        lt(medicationDoses.occurredAt, range.end),
      ),
    )
    .orderBy(desc(medicationDoses.occurredAt));

  return rows.map((record) => ({
    id: record.id,
    type: "medicationDose",
    occurredAt: record.occurredAt,
    media: [],
    record,
  }));
}

async function fetchHospitalVisitEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(hospitalVisits)
    .where(
      and(
        eq(hospitalVisits.catId, catId),
        gte(hospitalVisits.visitedAt, range.start),
        lt(hospitalVisits.visitedAt, range.end),
      ),
    )
    .orderBy(desc(hospitalVisits.visitedAt));

  return rows.map((record) => ({
    id: record.id,
    type: "hospitalVisit",
    occurredAt: record.visitedAt,
    media: [],
    record,
  }));
}

async function fetchCatPhotoEntries(
  catId: string,
  range: DateRange,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(catPhotos)
    .where(
      and(
        eq(catPhotos.catId, catId),
        gte(catPhotos.takenAt, range.start),
        lt(catPhotos.takenAt, range.end),
      ),
    )
    .orderBy(desc(catPhotos.takenAt));

  return rows.map((record) => ({
    id: record.id,
    type: "catPhoto",
    occurredAt: record.takenAt,
    media: [],
    record,
  }));
}

const FETCHERS: Record<
  TimelineRecordType,
  (catId: string, range: DateRange) => Promise<TimelineEntry[]>
> = {
  feeding: fetchFeedingEntries,
  poop: fetchPoopEntries,
  weight: fetchWeightEntries,
  vomit: fetchVomitEntries,
  water: fetchWaterEntries,
  shampoo: fetchShampooEntries,
  cleaning: fetchCleaningEntries,
  symptom: fetchSymptomEntries,
  medicationDose: fetchMedicationDoseEntries,
  hospitalVisit: fetchHospitalVisitEntries,
  catPhoto: fetchCatPhotoEntries,
};

export type ListTimelineForMonthOptions = {
  page?: number;
  pageSize?: number;
  /** 指定すると、一覧（entries・hasMore）を月内のこの日付（YYYY-MM-DD）だけに絞り込む。
   * カレンダー用の datesByDay は指定の有無にかかわらず月全体を対象にする */
  date?: string;
};

export type ListTimelineForMonthResult = {
  entries: TimelineEntry[];
  hasMore: boolean;
  /** 記録がある日付ごとの記録種別一覧（カレンダー表示用、月全体が対象） */
  datesByDay: Map<string, TimelineRecordType[]>;
};

export const MAX_PAGE = 100_000;
const MAX_PAGE_SIZE = 100;

// 不正・過大な入力（Infinity・NaN・小数・巨大な値など）が limit/offset の
// 計算に直接使われないよう、有限の正の整数に丸めてから使う。不正値
// （非有限）は「最大の問い合わせ件数」ではなく最小値（1）にフォールバック
// させ、意図（過大な読み出しを避ける）と逆の挙動にならないようにする
export function normalizePositiveInt(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const truncated = Math.trunc(value);
  return Math.min(Math.max(truncated, 1), max);
}

function getMonthRangeUtc(year: number, month: number): DateRange {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * 発生日時は `splitDateTimeUtc` と同じ基準（保存値をそのまま UTC の年月日として扱う）で
 * 日付に振り分ける。カレンダー表示用。
 */
function buildDatesByDay(
  entries: TimelineEntry[],
): Map<string, TimelineRecordType[]> {
  const typesByDate = new Map<string, Set<TimelineRecordType>>();
  for (const entry of entries) {
    const key = splitDateTimeUtc(entry.occurredAt).date;
    const set = typesByDate.get(key) ?? new Set<TimelineRecordType>();
    set.add(entry.type);
    typesByDate.set(key, set);
  }

  const ordered = new Map<string, TimelineRecordType[]>();
  for (const [date, set] of typesByDate) {
    ordered.set(
      date,
      TIMELINE_RECORD_TYPES.filter((type) => set.has(type)),
    );
  }
  return ordered;
}

/**
 * 指定した年月の記録を、各テーブルを個別に取得したうえで JS 側でマージ・並び替えして返す。
 * 月という自然な範囲で区切っているため、件数は個人利用規模の D1 を前提とすればテーブルごとの
 * limit なしで扱える程度に収まる想定で、SQL の UNION ALL は使わない。
 * カレンダー用の datesByDay は、`date` で1日に絞り込む前の月全体のエントリから求めるため、
 * 一覧を特定の日に絞り込んでもカレンダーには月全体のアイコンが残る。
 */
export async function listTimelineForMonth(
  catId: string,
  year: number,
  month: number, // 1-12
  options: ListTimelineForMonthOptions = {},
): Promise<ListTimelineForMonthResult> {
  const pageSize = normalizePositiveInt(options.pageSize ?? 20, MAX_PAGE_SIZE);

  const range = getMonthRangeUtc(year, month);
  const results = await Promise.all(
    TIMELINE_RECORD_TYPES.map((type) => FETCHERS[type](catId, range)),
  );
  const merged = results.flat().sort((a, b) => {
    const byOccurredAt = b.occurredAt.getTime() - a.occurredAt.getTime();
    // 同時刻のレコードが複数あると DB から返る順序が読み出しごとに変わり
    // うるため、id を tie-breaker にしてページ間で結果を安定させる
    return byOccurredAt !== 0 ? byOccurredAt : a.id.localeCompare(b.id);
  });

  const datesByDay = buildDatesByDay(merged);

  const filtered = options.date
    ? merged.filter(
        (entry) => splitDateTimeUtc(entry.occurredAt).date === options.date,
      )
    : merged;

  const maxPage = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const page = Math.min(
    normalizePositiveInt(options.page ?? 1, MAX_PAGE),
    maxPage,
  );
  const start = (page - 1) * pageSize;
  const entries = await attachMedia(filtered.slice(start, start + pageSize));
  const hasMore = filtered.length > start + pageSize;

  return { entries, hasMore, datesByDay };
}

/**
 * 表示するページ分のエントリに、記録種別を横断して media_assets を引き当てる
 */
async function attachMedia(entries: TimelineEntry[]): Promise<TimelineEntry[]> {
  const refs = entries.flatMap((entry) => {
    const recordType = TIMELINE_MEDIA_RECORD_TYPES[entry.type];
    return recordType ? [{ recordType, recordId: entry.id }] : [];
  });
  if (refs.length === 0) {
    return entries;
  }
  const mediaByRecord = await listMediaAssetsForRecords(refs);
  return entries.map((entry) => {
    const recordType = TIMELINE_MEDIA_RECORD_TYPES[entry.type];
    if (!recordType) {
      return entry;
    }
    const assets =
      mediaByRecord.get(mediaRecordKey(recordType, entry.id)) ?? [];
    return { ...entry, media: assets.map(toMediaAssetView) };
  });
}
