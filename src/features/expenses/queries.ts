import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  cats,
  type ExpenseRecord,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
} from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { YearMonth } from "@/features/shared/yearMonth";

/** 支出記録と、それに紐付く猫・通院記録（病院代として紐付くもの）の一覧 */
export type ExpenseWithCats = ExpenseRecord & {
  catIds: string[];
  hospitalVisitIds: string[];
};

export function getMonthRangeUtc(
  year: number,
  month: number, // 1-12
): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * 支出記録 ID ごとの紐付く猫 ID を取得する。一覧で N+1 クエリにならないよう、
 * まとめて引いてグループ化する
 */
export async function listCatIdsByExpenseRecords(
  expenseRecordIds: string[],
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  if (expenseRecordIds.length === 0) {
    return grouped;
  }
  const db = getDb();
  for (const ids of chunkForBoundParameters(expenseRecordIds)) {
    const rows = await db
      .select({
        expenseRecordId: expenseRecordCats.expenseRecordId,
        catId: expenseRecordCats.catId,
      })
      .from(expenseRecordCats)
      .innerJoin(cats, eq(expenseRecordCats.catId, cats.id))
      .where(inArray(expenseRecordCats.expenseRecordId, ids))
      .orderBy(asc(cats.createdAt));
    for (const row of rows) {
      const list = grouped.get(row.expenseRecordId) ?? [];
      list.push(row.catId);
      grouped.set(row.expenseRecordId, list);
    }
  }
  return grouped;
}

/**
 * 支出記録 ID ごとの、病院代として紐付く通院記録 ID を受診日時の順に取得する。
 * 一覧で N+1 クエリにならないよう、まとめて引いてグループ化する
 */
export async function listHospitalVisitIdsByExpenseRecords(
  expenseRecordIds: string[],
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  if (expenseRecordIds.length === 0) {
    return grouped;
  }
  const db = getDb();
  for (const ids of chunkForBoundParameters(expenseRecordIds)) {
    const rows = await db
      .select({
        expenseRecordId: expenseRecordHospitalVisits.expenseRecordId,
        hospitalVisitId: expenseRecordHospitalVisits.hospitalVisitId,
      })
      .from(expenseRecordHospitalVisits)
      .innerJoin(
        hospitalVisits,
        eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisits.id),
      )
      .where(inArray(expenseRecordHospitalVisits.expenseRecordId, ids))
      .orderBy(asc(hospitalVisits.visitedAt), asc(hospitalVisits.id));
    for (const row of rows) {
      const list = grouped.get(row.expenseRecordId) ?? [];
      list.push(row.hospitalVisitId);
      grouped.set(row.expenseRecordId, list);
    }
  }
  return grouped;
}

async function attachCatIds(
  records: ExpenseRecord[],
): Promise<ExpenseWithCats[]> {
  const recordIds = records.map((record) => record.id);
  const [catIdsByRecord, hospitalVisitIdsByRecord] = await Promise.all([
    listCatIdsByExpenseRecords(recordIds),
    listHospitalVisitIdsByExpenseRecords(recordIds),
  ]);
  return records.map((record) => ({
    ...record,
    catIds: catIdsByRecord.get(record.id) ?? [],
    hospitalVisitIds: hospitalVisitIdsByRecord.get(record.id) ?? [],
  }));
}

export type ListExpensesForMonthOptions = {
  /** 指定すると、その猫に紐付く支出だけに絞り込む */
  catId?: string;
};

/**
 * 指定した年月の支出記録を新しい順に返す。支出はすべての猫で共通のため、
 * 既定では猫で絞り込まず、月全体の支出を返す
 */
export async function listExpensesForMonth(
  year: number,
  month: number, // 1-12
  options: ListExpensesForMonthOptions = {},
): Promise<ExpenseWithCats[]> {
  const db = getDb();
  const range = getMonthRangeUtc(year, month);
  const inMonth = and(
    gte(expenseRecords.spentAt, range.start),
    lt(expenseRecords.spentAt, range.end),
  );
  const order = [desc(expenseRecords.spentAt), asc(expenseRecords.id)];

  const forCat =
    options.catId == null
      ? undefined
      : inArray(
          expenseRecords.id,
          db
            .select({ id: expenseRecordCats.expenseRecordId })
            .from(expenseRecordCats)
            .where(eq(expenseRecordCats.catId, options.catId)),
        );
  const records = await db
    .select()
    .from(expenseRecords)
    .where(and(inMonth, forCat))
    .orderBy(...order);

  return attachCatIds(records);
}

export type ExpenseAmountRecord = Pick<
  ExpenseRecord,
  "spentAt" | "category" | "amountYen"
>;

/**
 * 月別の支出グラフ用に、`from` 月の月初から `to` 月の月末までの支出の
 * 日付・カテゴリ・金額だけを返す。猫の紐付けは不要なので attachCatIds は通さない
 */
export async function listExpenseAmountsForMonthRange(
  from: YearMonth,
  to: YearMonth,
  options: ListExpensesForMonthOptions = {},
): Promise<ExpenseAmountRecord[]> {
  const db = getDb();
  const start = getMonthRangeUtc(from.year, from.month).start;
  const end = getMonthRangeUtc(to.year, to.month).end;

  const forCat =
    options.catId == null
      ? undefined
      : inArray(
          expenseRecords.id,
          db
            .select({ id: expenseRecordCats.expenseRecordId })
            .from(expenseRecordCats)
            .where(eq(expenseRecordCats.catId, options.catId)),
        );
  return db
    .select({
      spentAt: expenseRecords.spentAt,
      category: expenseRecords.category,
      amountYen: expenseRecords.amountYen,
    })
    .from(expenseRecords)
    .where(
      and(
        gte(expenseRecords.spentAt, start),
        lt(expenseRecords.spentAt, end),
        forCat,
      ),
    );
}

export async function getExpenseById(
  id: string,
): Promise<ExpenseWithCats | null> {
  const db = getDb();
  const [record] = await db
    .select()
    .from(expenseRecords)
    .where(eq(expenseRecords.id, id))
    .limit(1);
  if (record == null) {
    return null;
  }
  const [withCats] = await attachCatIds([record]);
  return withCats;
}

/** 通院記録に紐付く病院代の支出記録を取得する */
export async function getExpenseByHospitalVisitId(
  hospitalVisitId: string,
): Promise<ExpenseWithCats | null> {
  const byVisitId = await listExpensesByHospitalVisitIds([hospitalVisitId]);
  return byVisitId.get(hospitalVisitId) ?? null;
}

/**
 * 通院記録 ID ごとの病院代（支出記録）を取得する。複数の通院記録で 1 件の支出を
 * 共有している場合は、それぞれの通院記録 ID に同じ支出記録を対応させる。
 * 通院記録の一覧で N+1 クエリにならないよう、まとめて引く
 */
export async function listExpensesByHospitalVisitIds(
  hospitalVisitIds: string[],
): Promise<Map<string, ExpenseWithCats>> {
  const byVisitId = new Map<string, ExpenseWithCats>();
  if (hospitalVisitIds.length === 0) {
    return byVisitId;
  }
  const db = getDb();
  const rows: { hospitalVisitId: string; record: ExpenseRecord }[] = [];
  for (const ids of chunkForBoundParameters(hospitalVisitIds)) {
    rows.push(
      ...(await db
        .select({
          hospitalVisitId: expenseRecordHospitalVisits.hospitalVisitId,
          record: expenseRecords,
        })
        .from(expenseRecordHospitalVisits)
        .innerJoin(
          expenseRecords,
          eq(expenseRecordHospitalVisits.expenseRecordId, expenseRecords.id),
        )
        .where(inArray(expenseRecordHospitalVisits.hospitalVisitId, ids))),
    );
  }
  const uniqueRecords = [
    ...new Map(rows.map((row) => [row.record.id, row.record])).values(),
  ];
  const withCatsById = new Map(
    (await attachCatIds(uniqueRecords)).map((record) => [record.id, record]),
  );
  for (const row of rows) {
    const record = withCatsById.get(row.record.id);
    if (record != null) {
      byVisitId.set(row.hospitalVisitId, record);
    }
  }
  return byVisitId;
}

/** 通院記録の作成時に、紐付けるかを確認する候補として表示する支出記録 */
export type HospitalExpenseCandidate = Pick<
  ExpenseRecord,
  "id" | "amountYen" | "memo"
> & {
  catNames: string[];
};

/**
 * 指定した日（`YYYY-MM-DD`）のカテゴリ「病院」の支出記録を、関連する猫の名前と一緒に返す。
 * 通院記録を作成するときに、同じ日の病院代と紐付けるかを確認するために使う
 */
export async function listHospitalExpensesOnDate(
  date: string,
): Promise<HospitalExpenseCandidate[]> {
  const db = getDb();
  const start = combineDateTimeUtc(date, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const records = await db
    .select()
    .from(expenseRecords)
    .where(
      and(
        eq(expenseRecords.category, "hospital"),
        gte(expenseRecords.spentAt, start),
        lt(expenseRecords.spentAt, end),
      ),
    )
    .orderBy(asc(expenseRecords.createdAt), asc(expenseRecords.id));
  if (records.length === 0) {
    return [];
  }
  const catIdsByRecord = await listCatIdsByExpenseRecords(
    records.map((record) => record.id),
  );
  const catNameById = new Map(
    (await db.select({ id: cats.id, name: cats.name }).from(cats)).map(
      (cat) => [cat.id, cat.name],
    ),
  );
  return records.map((record) => ({
    id: record.id,
    amountYen: record.amountYen,
    memo: record.memo,
    catNames: (catIdsByRecord.get(record.id) ?? []).map(
      (catId) => catNameById.get(catId) ?? "不明な猫",
    ),
  }));
}
