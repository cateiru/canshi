import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  type FeedingRecord,
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

type TimelineEntryOf<T extends TimelineRecordType, R> = {
  id: string;
  type: T;
  occurredAt: Date;
  record: R;
};

export type TimelineEntry =
  | TimelineEntryOf<"feeding", FeedingRecord & { foodProductName: string }>
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
  const rows = await db
    .select({
      id: feedingRecords.id,
      catId: feedingRecords.catId,
      foodProductId: feedingRecords.foodProductId,
      foodProductName: foodProducts.name,
      occurredAt: feedingRecords.occurredAt,
      givenAmountG: feedingRecords.givenAmountG,
      leftoverAmountG: feedingRecords.leftoverAmountG,
      estimatedIntakeG: feedingRecords.estimatedIntakeG,
      estimatedKcal: feedingRecords.estimatedKcal,
      createdAt: feedingRecords.createdAt,
      updatedAt: feedingRecords.updatedAt,
    })
    .from(feedingRecords)
    .innerJoin(foodProducts, eq(feedingRecords.foodProductId, foodProducts.id))
    .where(eq(feedingRecords.catId, catId))
    .orderBy(desc(feedingRecords.occurredAt))
    .limit(limit);

  return rows.map((record) => ({
    id: record.id,
    type: "feeding",
    occurredAt: record.occurredAt,
    record,
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

const MAX_PAGE = 100_000;
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
function normalizePositiveInt(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const truncated = Math.trunc(value);
  return Math.min(Math.max(truncated, 1), max);
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
  const page = normalizePositiveInt(options.page ?? 1, MAX_PAGE);
  const depth = Math.min(page * pageSize, MAX_DEPTH);

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
  const entries = merged.slice(start, start + pageSize);
  const hasMore = merged.length > start + pageSize;

  return { entries, hasMore };
}
