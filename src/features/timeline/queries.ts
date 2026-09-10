import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
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
  type Symptom,
  symptoms,
  type VomitRecord,
  vomitRecords,
  type WeightRecord,
  weightRecords,
} from "@/db/schema";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "@/features/hospital-visits/media";
import {
  listMediaAssetsForRecords,
  mediaRecordKey,
} from "@/features/media/queries";
import type { MediaRecordType } from "@/features/media/recordTypes";
import { type MediaAssetView, toMediaAssetView } from "@/features/media/view";
import { POOP_RECORD_MEDIA_TYPE } from "@/features/poop-records/media";
import { SYMPTOM_MEDIA_TYPE } from "@/features/symptoms/media";
import { VOMIT_RECORD_MEDIA_TYPE } from "@/features/vomit-records/media";

export const TIMELINE_RECORD_TYPES = [
  "feeding",
  "poop",
  "weight",
  "vomit",
  "symptom",
  "medicationDose",
  "hospitalVisit",
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
  | TimelineEntryOf<"symptom", Symptom>
  | TimelineEntryOf<
      "medicationDose",
      MedicationDose & { medicationName: string }
    >
  | TimelineEntryOf<"hospitalVisit", HospitalVisit>;

async function fetchFeedingEntries(
  catId: string,
  limit: number,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const headers = await db
    .select({
      id: feedingRecords.id,
      catId: feedingRecords.catId,
      occurredAt: feedingRecords.occurredAt,
    })
    .from(feedingRecords)
    .where(eq(feedingRecords.catId, catId))
    .orderBy(desc(feedingRecords.occurredAt))
    .limit(limit);

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
  limit: number,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(poopRecords)
    .where(eq(poopRecords.catId, catId))
    .orderBy(desc(poopRecords.occurredAt))
    .limit(limit);

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
  limit: number,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(weightRecords)
    .where(eq(weightRecords.catId, catId))
    .orderBy(desc(weightRecords.occurredAt))
    .limit(limit);

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
  limit: number,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(vomitRecords)
    .where(eq(vomitRecords.catId, catId))
    .orderBy(desc(vomitRecords.occurredAt))
    .limit(limit);

  return rows.map((record) => ({
    id: record.id,
    type: "vomit",
    occurredAt: record.occurredAt,
    media: [],
    record,
  }));
}

async function fetchSymptomEntries(
  catId: string,
  limit: number,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(symptoms)
    .where(eq(symptoms.catId, catId))
    .orderBy(desc(symptoms.onsetAt))
    .limit(limit);

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
  limit: number,
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
    .where(eq(medicationDoses.catId, catId))
    .orderBy(desc(medicationDoses.occurredAt))
    .limit(limit);

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
  limit: number,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(hospitalVisits)
    .where(eq(hospitalVisits.catId, catId))
    .orderBy(desc(hospitalVisits.visitedAt))
    .limit(limit);

  return rows.map((record) => ({
    id: record.id,
    type: "hospitalVisit",
    occurredAt: record.visitedAt,
    media: [],
    record,
  }));
}

const FETCHERS: Record<
  TimelineRecordType,
  (catId: string, limit: number) => Promise<TimelineEntry[]>
> = {
  feeding: fetchFeedingEntries,
  poop: fetchPoopEntries,
  weight: fetchWeightEntries,
  vomit: fetchVomitEntries,
  symptom: fetchSymptomEntries,
  medicationDose: fetchMedicationDoseEntries,
  hospitalVisit: fetchHospitalVisitEntries,
};

export type ListTimelineEntriesOptions = {
  /** 省略時はすべての種類を対象にする。空配列を渡した場合は何も表示しない */
  types?: TimelineRecordType[];
  page?: number;
  pageSize?: number;
};

export const MAX_PAGE = 100_000;
const MAX_PAGE_SIZE = 100;
// page * pageSize（depth）は、この上限を超えないようクランプする。
// MAX_PAGE・MAX_PAGE_SIZE の組み合わせをそのまま許すと depth が最大
// 10,000,000 になり得て、テーブルごとの .limit(...) と JS 側のソートに
// 過大な負荷がかかるため、個人利用規模の D1 を前提に別途上限を設ける
const MAX_DEPTH = 2_000;

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

// depth（page * pageSize）が MAX_DEPTH を超えないようにするための、
// pageSize に応じた最大ページ番号。MAX_PAGE までクランプしただけの page を
// そのまま使うと、depth 側だけ MAX_DEPTH でクランプされて「実データが
// あるのに常に空配列が返るページ」が発生するため、listTimelineEntries と
// ページネーションリンク生成側（page.tsx）の両方でこの値を使って page 自体を
// クランプし、クエリ結果とリンクのページ番号がずれないようにする
export function maxPageForPageSize(pageSize: number): number {
  return Math.max(Math.floor(MAX_DEPTH / pageSize), 1);
}

/**
 * 各記録テーブルを個別に取得したうえで JS 側でマージ・並び替え・ページングする。
 * 各テーブルから要求ページの深さ（page * pageSize）分だけ取得すれば、
 * テーブルをまたいだ正しい降順の上位 N 件を再構成できる
 * （ある記録が全体の上位 N 件に入るなら、そのテーブル自身の中でも上位 N 件に入るため）。
 * 個人利用規模の D1 を前提としたシンプルな実装で、SQL の UNION ALL は使わない。
 */
export async function listTimelineEntries(
  catId: string,
  options: ListTimelineEntriesOptions = {},
): Promise<{ entries: TimelineEntry[]; hasMore: boolean }> {
  // 呼び出し側から重複を含む types が渡される可能性があるため重複排除する
  const types = [...new Set(options.types ?? TIMELINE_RECORD_TYPES)];
  const pageSize = normalizePositiveInt(options.pageSize ?? 20, MAX_PAGE_SIZE);
  const requestedPage = normalizePositiveInt(options.page ?? 1, MAX_PAGE);
  const page = Math.min(requestedPage, maxPageForPageSize(pageSize));
  const depth = page * pageSize;

  if (types.length === 0) {
    return { entries: [], hasMore: false };
  }

  // hasMore の判定用に、必要な深さより1件多く取得する。ちょうど depth 件で
  // 打ち切ると、1つの記録種別だけで depth 件を超えるケースで「次のページが
  // ある」ことを検出できない（false negative になる）ため
  const results = await Promise.all(
    types.map((type) => FETCHERS[type](catId, depth + 1)),
  );
  const merged = results.flat().sort((a, b) => {
    const byOccurredAt = b.occurredAt.getTime() - a.occurredAt.getTime();
    // 同時刻のレコードが複数あると DB から返る順序が読み出しごとに変わり
    // うるため、id を tie-breaker にしてページ間で結果を安定させる
    return byOccurredAt !== 0 ? byOccurredAt : a.id.localeCompare(b.id);
  });

  const start = (page - 1) * pageSize;
  const entries = await attachMedia(merged.slice(start, start + pageSize));
  const hasMore = merged.length > start + pageSize;

  return { entries, hasMore };
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
