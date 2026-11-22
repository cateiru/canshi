import { and, asc, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db/client";
import {
  brushingRecords,
  cats,
  cleaningRecords,
  cleaningTargets,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  hospitalVisits,
  mediaAssets,
  medicationDoses,
  medications,
  memoRecords,
  poopRecords,
  shampooRecords,
  symptoms,
  vomitRecords,
  waterRecords,
  weightRecords,
} from "@/db/schema";
import type { CsvFile } from "../domain/csv";
import {
  brushingCsvFile,
  cleaningCsvFile,
  type ExportMediaPaths,
  expenseCsvFile,
  feedingCsvFile,
  hospitalVisitCsvFile,
  medicationCsvFiles,
  memoCsvFile,
  poopCsvFile,
  recordExportMediaPath,
  shampooCsvFile,
  symptomCsvFile,
  vomitCsvFile,
  waterCsvFile,
  weightCsvFile,
} from "../domain/csvFiles";
import {
  RECORD_EXPORT_MEDIA_TYPES,
  type RecordExportType,
} from "../domain/recordExport";

type Db = ReturnType<typeof getDb>;

/** zip に入れる写真・動画 1 つ分 */
export type RecordExportMediaEntry = {
  /** zip の中のパス */
  path: string;
  /** R2 のオブジェクトキー */
  objectKey: string;
  sizeBytes: number;
};

/** zip に入れる中身 */
export type RecordExportContents = {
  csvFiles: CsvFile[];
  media: RecordExportMediaEntry[];
};

/** 猫に属し、論理削除する記録のテーブル */
type CatRecordTable = SQLiteTable & {
  id: SQLiteColumn;
  catId: SQLiteColumn;
  deletedAt: SQLiteColumn;
};

/** 記録が家の猫のもので、削除されていない条件 */
function liveHouseholdRecord(table: CatRecordTable, householdId: string): SQL {
  return and(eq(cats.householdId, householdId), isNull(table.deletedAt)) as SQL;
}

/** 同じ日時の記録を作った順に並べるため、rowid を 2 番目の並び順にする */
function rowidOf(table: SQLiteTable): SQL {
  return sql`${table}.rowid`;
}

/**
 * 家の記録から、zip に入れる CSV と写真・動画の一覧を作る。家のすべての猫（メモリーへ移した猫も含む）の、
 * 削除していない記録を対象にし、記録は古い順に並べる。写真・動画は中身を読まず、R2 のキーだけを返す
 */
export async function loadRecordExportContents(
  householdId: string,
  types: readonly RecordExportType[],
  includeMedia: boolean,
  d1?: D1Database,
): Promise<RecordExportContents> {
  const db = getDb(d1);
  const csvFiles: CsvFile[] = [];
  const media: RecordExportMediaEntry[] = [];

  for (const type of types) {
    let mediaPaths: ExportMediaPaths | undefined;
    const mediaType = RECORD_EXPORT_MEDIA_TYPES[type];
    if (includeMedia && mediaType) {
      const entries = await listRecordMedia(db, type, mediaType, householdId);
      media.push(...entries.flatMap(({ entries }) => entries));
      mediaPaths = new Map(
        entries.map(({ recordId, entries }) => [
          recordId,
          entries.map(({ path }) => path),
        ]),
      );
    }
    csvFiles.push(...(await loadCsvFiles(db, type, householdId, mediaPaths)));
  }

  return { csvFiles, media };
}

async function loadCsvFiles(
  db: Db,
  type: RecordExportType,
  householdId: string,
  mediaPaths: ExportMediaPaths | undefined,
): Promise<CsvFile[]> {
  switch (type) {
    case "feeding":
      return [feedingCsvFile(await listFeedingRows(db, householdId))];
    case "poop":
      return [
        poopCsvFile(
          await listCatRecords(
            db,
            poopRecords,
            householdId,
            poopRecords.occurredAt,
          ),
          mediaPaths,
        ),
      ];
    case "weight":
      return [
        weightCsvFile(
          await listCatRecords(
            db,
            weightRecords,
            householdId,
            weightRecords.occurredAt,
          ),
        ),
      ];
    case "vomit":
      return [
        vomitCsvFile(
          await listCatRecords(
            db,
            vomitRecords,
            householdId,
            vomitRecords.occurredAt,
          ),
          mediaPaths,
        ),
      ];
    case "water":
      return [
        waterCsvFile(
          await listCatRecords(
            db,
            waterRecords,
            householdId,
            waterRecords.occurredAt,
          ),
        ),
      ];
    case "shampoo":
      return [
        shampooCsvFile(
          await listCatRecords(
            db,
            shampooRecords,
            householdId,
            shampooRecords.performedAt,
          ),
        ),
      ];
    case "brushing":
      return [
        brushingCsvFile(
          await listCatRecords(
            db,
            brushingRecords,
            householdId,
            brushingRecords.performedAt,
          ),
        ),
      ];
    case "cleaning":
      return [cleaningCsvFile(await listCleaningRows(db, householdId))];
    case "symptom":
      return [
        symptomCsvFile(
          await listCatRecords(db, symptoms, householdId, symptoms.onsetAt),
          mediaPaths,
        ),
      ];
    case "medication":
      return medicationCsvFiles(
        await listCatRecords(
          db,
          medications,
          householdId,
          medications.startDate,
        ),
        await listMedicationDoseRows(db, householdId),
        mediaPaths,
      );
    case "hospitalVisit":
      return [
        hospitalVisitCsvFile(
          await listCatRecords(
            db,
            hospitalVisits,
            householdId,
            hospitalVisits.visitedAt,
          ),
          mediaPaths,
        ),
      ];
    case "expense":
      return [
        expenseCsvFile(await listExpenseRows(db, householdId), mediaPaths),
      ];
    case "memo":
      return [
        memoCsvFile(
          await listCatRecords(
            db,
            memoRecords,
            householdId,
            // 日付を残さないメモ（NULL）は最後に並べる
            sql`${memoRecords.recordedAt} IS NULL, ${memoRecords.recordedAt}`,
          ),
          mediaPaths,
        ),
      ];
  }
}

/** 猫に属する記録を、猫の名前を添えて古い順に返す */
async function listCatRecords<TTable extends CatRecordTable>(
  db: Db,
  table: TTable,
  householdId: string,
  orderBy: SQLiteColumn | SQL,
): Promise<(TTable["$inferSelect"] & { catName: string })[]> {
  const rows = await db
    .select({ record: table as SQLiteTable, catName: cats.name })
    .from(table as SQLiteTable)
    .innerJoin(cats, eq(cats.id, table.catId))
    .where(liveHouseholdRecord(table, householdId))
    .orderBy(asc(orderBy), asc(rowidOf(table)));
  return rows.map(({ record, catName }) => ({
    ...(record as TTable["$inferSelect"]),
    catName,
  }));
}

async function listFeedingRows(db: Db, householdId: string) {
  const records = await listCatRecords(
    db,
    feedingRecords,
    householdId,
    feedingRecords.occurredAt,
  );
  const items = await db
    .select({ item: feedingRecordItems, productName: foodProducts.name })
    .from(feedingRecordItems)
    .innerJoin(
      feedingRecords,
      eq(feedingRecords.id, feedingRecordItems.feedingRecordId),
    )
    .innerJoin(cats, eq(cats.id, feedingRecords.catId))
    .innerJoin(
      foodProducts,
      eq(foodProducts.id, feedingRecordItems.foodProductId),
    )
    .where(liveHouseholdRecord(feedingRecords, householdId))
    .orderBy(
      asc(feedingRecordItems.sortOrder),
      asc(rowidOf(feedingRecordItems)),
    );
  const itemsByRecord = new Map<
    string,
    ((typeof items)[number]["item"] & { productName: string })[]
  >();
  for (const { item, productName } of items) {
    const list = itemsByRecord.get(item.feedingRecordId) ?? [];
    list.push({ ...item, productName });
    itemsByRecord.set(item.feedingRecordId, list);
  }
  return records.map((record) => ({
    ...record,
    items: itemsByRecord.get(record.id) ?? [],
  }));
}

async function listCleaningRows(db: Db, householdId: string) {
  const rows = await db
    .select({
      record: cleaningRecords,
      catName: cats.name,
      targetName: cleaningTargets.name,
    })
    .from(cleaningRecords)
    .innerJoin(cats, eq(cats.id, cleaningRecords.catId))
    .innerJoin(
      cleaningTargets,
      eq(cleaningTargets.id, cleaningRecords.cleaningTargetId),
    )
    .where(liveHouseholdRecord(cleaningRecords, householdId))
    .orderBy(asc(cleaningRecords.performedAt), asc(rowidOf(cleaningRecords)));
  return rows.map(({ record, catName, targetName }) => ({
    ...record,
    catName,
    targetName,
  }));
}

async function listMedicationDoseRows(db: Db, householdId: string) {
  const rows = await db
    .select({
      dose: medicationDoses,
      catName: cats.name,
      medicationName: medications.name,
    })
    .from(medicationDoses)
    .innerJoin(cats, eq(cats.id, medicationDoses.catId))
    .innerJoin(medications, eq(medications.id, medicationDoses.medicationId))
    .where(liveHouseholdRecord(medicationDoses, householdId))
    .orderBy(asc(medicationDoses.occurredAt), asc(rowidOf(medicationDoses)));
  return rows.map(({ dose, catName, medicationName }) => ({
    ...dose,
    catName,
    medicationName,
  }));
}

/** 家の支出記録を、関連するねこの名前と病院代として紐付けた通院記録の ID を添えて古い順に返す */
async function listExpenseRows(db: Db, householdId: string) {
  const liveHouseholdExpense = and(
    eq(expenseRecords.householdId, householdId),
    isNull(expenseRecords.deletedAt),
  );
  const records = await db
    .select()
    .from(expenseRecords)
    .where(liveHouseholdExpense)
    .orderBy(asc(expenseRecords.spentAt), asc(rowidOf(expenseRecords)));
  const catLinks = await db
    .select({
      expenseRecordId: expenseRecordCats.expenseRecordId,
      catName: cats.name,
    })
    .from(expenseRecordCats)
    .innerJoin(
      expenseRecords,
      eq(expenseRecords.id, expenseRecordCats.expenseRecordId),
    )
    .innerJoin(cats, eq(cats.id, expenseRecordCats.catId))
    .where(liveHouseholdExpense)
    // 関連するねこは登録した順に並べる
    .orderBy(asc(cats.createdAt), asc(rowidOf(cats)));
  const visitLinks = await db
    .select({
      expenseRecordId: expenseRecordHospitalVisits.expenseRecordId,
      hospitalVisitId: expenseRecordHospitalVisits.hospitalVisitId,
    })
    .from(expenseRecordHospitalVisits)
    .innerJoin(
      expenseRecords,
      eq(expenseRecords.id, expenseRecordHospitalVisits.expenseRecordId),
    )
    .where(liveHouseholdExpense)
    .orderBy(asc(expenseRecordHospitalVisits.hospitalVisitId));

  const catNames = groupBy(catLinks, (link) => link.catName);
  const visitIds = groupBy(visitLinks, (link) => link.hospitalVisitId);
  return records.map((record) => ({
    ...record,
    catNames: catNames.get(record.id) ?? [],
    hospitalVisitIds: visitIds.get(record.id) ?? [],
  }));
}

function groupBy<T extends { expenseRecordId: string }>(
  rows: T[],
  pick: (row: T) => string,
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.expenseRecordId) ?? [];
    list.push(pick(row));
    grouped.set(row.expenseRecordId, list);
  }
  return grouped;
}

/** 記録の種類ごとの、写真・動画を添付する記録のテーブル（服薬記録は服薬予定に添付する） */
const MEDIA_RECORD_TABLES: Partial<Record<RecordExportType, CatRecordTable>> = {
  poop: poopRecords,
  vomit: vomitRecords,
  symptom: symptoms,
  medication: medications,
  hospitalVisit: hospitalVisits,
  memo: memoRecords,
};

/**
 * 家の、削除していない記録に添付した写真・動画を、記録ごとに表示順で返す。
 * 削除した記録の写真・動画は含めない
 */
async function listRecordMedia(
  db: Db,
  type: RecordExportType,
  mediaType: string,
  householdId: string,
): Promise<{ recordId: string; entries: RecordExportMediaEntry[] }[]> {
  const table = MEDIA_RECORD_TABLES[type];
  const liveRecord = table
    ? sql`EXISTS (
        SELECT 1 FROM ${table}
        INNER JOIN ${cats} ON ${cats.id} = ${table.catId}
        WHERE ${table.id} = ${mediaAssets.recordId}
          AND ${cats.householdId} = ${householdId}
          AND ${table.deletedAt} IS NULL
      )`
    : sql`EXISTS (
        SELECT 1 FROM ${expenseRecords}
        WHERE ${expenseRecords.id} = ${mediaAssets.recordId}
          AND ${expenseRecords.householdId} = ${householdId}
          AND ${expenseRecords.deletedAt} IS NULL
      )`;
  const rows = await db
    .select({
      recordId: mediaAssets.recordId,
      objectKey: mediaAssets.objectKey,
      mimeType: mediaAssets.mimeType,
      sizeBytes: mediaAssets.sizeBytes,
    })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.recordType, mediaType), liveRecord))
    .orderBy(
      asc(mediaAssets.recordId),
      asc(mediaAssets.sortOrder),
      asc(mediaAssets.createdAt),
    );

  const grouped = new Map<string, RecordExportMediaEntry[]>();
  for (const row of rows) {
    const entries = grouped.get(row.recordId) ?? [];
    entries.push({
      path: recordExportMediaPath(
        type,
        row.recordId,
        entries.length,
        row.mimeType,
      ),
      objectKey: row.objectKey,
      sizeBytes: row.sizeBytes,
    });
    grouped.set(row.recordId, entries);
  }
  return [...grouped].map(([recordId, entries]) => ({ recordId, entries }));
}
