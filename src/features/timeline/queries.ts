import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  type BrushingRecord,
  brushingRecords,
  type CleaningRecord,
  cats,
  cleaningRecords,
  cleaningTargets,
  type ExpenseRecord,
  expenseRecordCats,
  expenseRecords,
  type FeedingMode,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  type GivenAmountLevel,
  type HospitalVisit,
  hospitalVisits,
  type LeftoverLevel,
  type MedicationDose,
  type MemoRecord,
  medicationDoses,
  medications,
  memoRecords,
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
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/media";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "@/features/hospital-visits/media";
import {
  listMediaAssetsForRecords,
  mediaRecordKey,
} from "@/features/media/queries";
import type { MediaRecordType } from "@/features/media/recordTypes";
import { type MediaAssetView, toMediaAssetView } from "@/features/media/view";
import { MEMO_RECORD_MEDIA_TYPE } from "@/features/memo-records/media";
import { POOP_RECORD_MEDIA_TYPE } from "@/features/poop-records/media";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { shiftYm, type YearMonth } from "@/features/shared/yearMonth";
import { SYMPTOM_MEDIA_TYPE } from "@/features/symptoms/media";
import { VOMIT_RECORD_MEDIA_TYPE } from "@/features/vomit-records/media";
import {
  listAnniversariesForMonth,
  type TimelineAdoptionRecord,
  type TimelineBirthdayRecord,
} from "./anniversaries";

/**
 * 記録ではなく、猫の生年月日・お迎え日から求める記念日の種別。
 * カレンダーの1日のアイコンは表示数に上限があるため、記録より先に並べて必ず見えるようにする
 */
const TIMELINE_ANNIVERSARY_TYPES = ["birthday", "adoption"] as const;

type TimelineAnniversaryType = (typeof TIMELINE_ANNIVERSARY_TYPES)[number];

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
  expense: EXPENSE_MEDIA_TYPE,
  memo: MEMO_RECORD_MEDIA_TYPE,
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

type DateRange = { start: Date; end: Date };

async function fetchFeedingEntries(
  catId: string,
  range: DateRange,
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
  const headers = await db
    .select({
      id: feedingRecords.id,
      catId: feedingRecords.catId,
      occurredAt: feedingRecords.occurredAt,
      mode: feedingRecords.mode,
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
      givenAmountLevel: feedingRecordItems.givenAmountLevel,
      leftoverLevel: feedingRecordItems.leftoverLevel,
    })
    .from(feedingRecordItems)
    // 記録の ID を列挙して inArray に渡すと、記録が多い月（カレンダー用に前後の月も含めるときは
    // 3 か月分）で D1 のバインドパラメーターの上限を超えるため、ヘッダーと同じ条件で結合して絞り込む
    .innerJoin(
      feedingRecords,
      eq(feedingRecordItems.feedingRecordId, feedingRecords.id),
    )
    .innerJoin(
      foodProducts,
      eq(feedingRecordItems.foodProductId, foodProducts.id),
    )
    .where(
      and(
        eq(feedingRecords.catId, catId),
        gte(feedingRecords.occurredAt, range.start),
        lt(feedingRecords.occurredAt, range.end),
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
      givenAmountLevel: row.givenAmountLevel,
      leftoverLevel: row.leftoverLevel,
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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

async function fetchBrushingEntries(
  catId: string,
  range: DateRange,
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
  const rows = await db
    .select()
    .from(brushingRecords)
    .where(
      and(
        eq(brushingRecords.catId, catId),
        gte(brushingRecords.performedAt, range.start),
        lt(brushingRecords.performedAt, range.end),
      ),
    )
    .orderBy(desc(brushingRecords.performedAt));

  return rows.map((record) => ({
    id: record.id,
    type: "brushing",
    occurredAt: record.performedAt,
    media: [],
    record,
  }));
}

async function fetchMemoEntries(
  catId: string,
  range: DateRange,
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
  // 日付を残さないメモ（recorded_at が NULL）は範囲の条件に一致しないため、タイムラインに載らない
  const rows = await db
    .select()
    .from(memoRecords)
    .where(
      and(
        eq(memoRecords.catId, catId),
        gte(memoRecords.recordedAt, range.start),
        lt(memoRecords.recordedAt, range.end),
      ),
    )
    .orderBy(desc(memoRecords.recordedAt));

  return rows.flatMap((record) => {
    const { recordedAt } = record;
    if (!recordedAt) {
      return [];
    }
    return [
      {
        id: record.id,
        type: "memo",
        occurredAt: recordedAt,
        media: [],
        record: { ...record, recordedAt },
      },
    ];
  });
}

async function fetchCleaningEntries(
  catId: string,
  range: DateRange,
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
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

/**
 * 支出記録は猫に直接紐付かず expense_record_cats 経由で多対多に紐付くため、
 * 表示中の猫に関連付けられた支出だけをタイムラインに出す。支出は家に属するため、
 * 猫の家の支出に限る
 */
async function fetchExpenseEntries(
  catId: string,
  range: DateRange,
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
  const rows = await db
    .select({ record: expenseRecords })
    .from(expenseRecords)
    .innerJoin(
      expenseRecordCats,
      eq(expenseRecordCats.expenseRecordId, expenseRecords.id),
    )
    .where(
      and(
        eq(expenseRecordCats.catId, catId),
        eq(
          expenseRecords.householdId,
          db
            .select({ householdId: cats.householdId })
            .from(cats)
            .where(eq(cats.id, catId)),
        ),
        gte(expenseRecords.spentAt, range.start),
        lt(expenseRecords.spentAt, range.end),
      ),
    )
    .orderBy(desc(expenseRecords.spentAt));

  return rows.map(({ record }) => ({
    id: record.id,
    type: "expense",
    occurredAt: record.spentAt,
    media: [],
    record,
  }));
}

/**
 * 猫の生年月日・お迎え日から、指定した月（複数可）の誕生日・お迎え記念日のエントリを作る。
 * 記念日は時刻を持たないため、発生日時はその日の 0 時（naive UTC）にする
 */
async function fetchAnniversaryEntries(
  catId: string,
  months: readonly YearMonth[],
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const db = getDb(d1);
  const [cat] = await db
    .select({ birthDate: cats.birthDate, adoptedAt: cats.adoptedAt })
    .from(cats)
    .where(eq(cats.id, catId))
    .limit(1);
  if (!cat) {
    return [];
  }

  return months.flatMap(({ year, month }) => {
    const { birthdays, adoptions } = listAnniversariesForMonth(
      cat,
      year,
      month,
    );
    return toAnniversaryEntries(catId, birthdays, adoptions);
  });
}

function toAnniversaryEntries(
  catId: string,
  birthdays: ReturnType<typeof listAnniversariesForMonth>["birthdays"],
  adoptions: ReturnType<typeof listAnniversariesForMonth>["adoptions"],
): TimelineEntry[] {
  return [
    ...birthdays.map(
      (record): TimelineEntry => ({
        id: `${catId}:birthday:${record.date}`,
        type: "birthday",
        occurredAt: new Date(`${record.date}T00:00:00.000Z`),
        media: [],
        record,
      }),
    ),
    ...adoptions.map(
      (record): TimelineEntry => ({
        id: `${catId}:adoption:${record.date}`,
        type: "adoption",
        occurredAt: new Date(`${record.date}T00:00:00.000Z`),
        media: [],
        record,
      }),
    ),
  ];
}

const FETCHERS: Record<
  Exclude<TimelineRecordType, TimelineAnniversaryType>,
  (catId: string, range: DateRange, d1?: D1Database) => Promise<TimelineEntry[]>
> = {
  feeding: fetchFeedingEntries,
  poop: fetchPoopEntries,
  weight: fetchWeightEntries,
  vomit: fetchVomitEntries,
  water: fetchWaterEntries,
  shampoo: fetchShampooEntries,
  brushing: fetchBrushingEntries,
  cleaning: fetchCleaningEntries,
  symptom: fetchSymptomEntries,
  medicationDose: fetchMedicationDoseEntries,
  hospitalVisit: fetchHospitalVisitEntries,
  expense: fetchExpenseEntries,
  memo: fetchMemoEntries,
};

export type ListTimelineForMonthOptions = {
  page?: number;
  pageSize?: number;
  /** 指定すると、一覧（entries・hasMore）を月内のこの日付（YYYY-MM-DD）だけに絞り込む。
   * カレンダー用の datesByDay は指定の有無にかかわらず月全体を対象にする */
  date?: string;
  /** 指定すると、この種類の記録だけを返す（datesByDay も含む）。省略時はすべての種類 */
  types?: readonly TimelineRecordType[];
  /** true のとき、datesByDay に前後の月の日付も含める（カレンダーをスワイプしたときに隣の月を見せるため）。
   * 一覧（entries・hasMore）は指定の有無にかかわらず指定した月だけを対象にする */
  includeAdjacentMonths?: boolean;
};

export type ListTimelineForMonthResult = {
  entries: TimelineEntry[];
  hasMore: boolean;
  /** 実際に表示するページ（総ページ数を超えるページが指定された場合は最終ページに丸める） */
  page: number;
  /** 総ページ数（記録が0件でも 1） */
  totalPages: number;
  /** 記録がある日付ごとの記録種別一覧（カレンダー表示用、月全体が対象。includeAdjacentMonths なら前後の月も含む） */
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
  d1?: D1Database,
): Promise<ListTimelineForMonthResult> {
  const pageSize = normalizePositiveInt(options.pageSize ?? 20, MAX_PAGE_SIZE);

  const months = options.includeAdjacentMonths
    ? [
        shiftYm({ year, month }, -1),
        { year, month },
        shiftYm({ year, month }, 1),
      ]
    : [{ year, month }];
  // 前後の月も含めるときも、テーブルごとの問い合わせは 1 回で済むよう 3 か月分をまとめて取る
  const range = {
    start: getMonthRangeUtc(months[0].year, months[0].month).start,
    end: getMonthRangeUtc(
      months[months.length - 1].year,
      months[months.length - 1].month,
    ).end,
  };
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  // 種類の絞り込みはページ分けの前に行い、1 ページの件数が減らないようにする
  const isIncluded = (type: TimelineRecordType) =>
    !options.types || options.types.includes(type);
  const fetchers = Object.entries(FETCHERS).flatMap(([type, fetcher]) =>
    isIncluded(type as TimelineRecordType) ? [fetcher] : [],
  );
  const results = await Promise.all([
    TIMELINE_ANNIVERSARY_TYPES.some(isIncluded)
      ? fetchAnniversaryEntries(catId, months, d1)
      : [],
    ...fetchers.map((fetcher) => fetcher(catId, range, d1)),
  ]);
  const merged = results
    .flat()
    .filter((entry) => isIncluded(entry.type))
    .sort(compareTimelineEntries);

  const datesByDay = buildDatesByDay(merged);

  const inMonth = options.includeAdjacentMonths
    ? merged.filter(
        (entry) => splitDateTimeUtc(entry.occurredAt).date.slice(0, 7) === ym,
      )
    : merged;
  const filtered = options.date
    ? inMonth.filter(
        (entry) => splitDateTimeUtc(entry.occurredAt).date === options.date,
      )
    : inMonth;

  const maxPage = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const page = Math.min(
    normalizePositiveInt(options.page ?? 1, MAX_PAGE),
    maxPage,
  );
  const start = (page - 1) * pageSize;
  const entries = await attachMedia(
    filtered.slice(start, start + pageSize),
    d1,
  );
  const hasMore = filtered.length > start + pageSize;

  return { entries, hasMore, page, totalPages: maxPage, datesByDay };
}

/**
 * 日付の降順に並べる。同じ日の中では記念日（0 時扱い）を記録より先頭に出し、
 * 記録同士は発生日時の降順にする
 */
function compareTimelineEntries(a: TimelineEntry, b: TimelineEntry): number {
  const aDate = splitDateTimeUtc(a.occurredAt).date;
  const bDate = splitDateTimeUtc(b.occurredAt).date;
  if (aDate !== bDate) {
    return aDate < bDate ? 1 : -1;
  }
  const byAnniversary =
    Number(isTimelineAnniversaryType(b.type)) -
    Number(isTimelineAnniversaryType(a.type));
  if (byAnniversary !== 0) {
    return byAnniversary;
  }
  const byOccurredAt = b.occurredAt.getTime() - a.occurredAt.getTime();
  // 同時刻のレコードが複数あると DB から返る順序が読み出しごとに変わり
  // うるため、id を tie-breaker にしてページ間で結果を安定させる
  return byOccurredAt !== 0 ? byOccurredAt : a.id.localeCompare(b.id);
}

/**
 * 表示するページ分のエントリに、記録種別を横断して media_assets を引き当てる
 */
async function attachMedia(
  entries: TimelineEntry[],
  d1?: D1Database,
): Promise<TimelineEntry[]> {
  const refs = entries.flatMap((entry) => {
    const recordType = TIMELINE_MEDIA_RECORD_TYPES[entry.type];
    return recordType ? [{ recordType, recordId: entry.id }] : [];
  });
  if (refs.length === 0) {
    return entries;
  }
  const mediaByRecord = await listMediaAssetsForRecords(refs, d1);
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
