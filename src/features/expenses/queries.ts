import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  cats,
  type ExpenseRecord,
  expenseRecordCats,
  expenseRecords,
} from "@/db/schema";
import type { YearMonth } from "@/features/shared/yearMonth";

/** 支出記録と、それに紐付く猫の一覧 */
export type ExpenseWithCats = ExpenseRecord & {
  catIds: string[];
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

async function attachCatIds(
  records: ExpenseRecord[],
): Promise<ExpenseWithCats[]> {
  const catIdsByRecord = await listCatIdsByExpenseRecords(
    records.map((record) => record.id),
  );
  return records.map((record) => ({
    ...record,
    catIds: catIdsByRecord.get(record.id) ?? [],
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
): Promise<ExpenseRecord | null> {
  const db = getDb();
  const [record] = await db
    .select()
    .from(expenseRecords)
    .where(eq(expenseRecords.hospitalVisitId, hospitalVisitId))
    .limit(1);
  return record ?? null;
}

/**
 * 通院記録 ID ごとの病院代（支出記録）を取得する。
 * 通院記録の一覧で N+1 クエリにならないよう、まとめて引く
 */
export async function listExpensesByHospitalVisitIds(
  hospitalVisitIds: string[],
): Promise<Map<string, ExpenseRecord>> {
  const byVisitId = new Map<string, ExpenseRecord>();
  if (hospitalVisitIds.length === 0) {
    return byVisitId;
  }
  const db = getDb();
  for (const ids of chunkForBoundParameters(hospitalVisitIds)) {
    const rows = await db
      .select()
      .from(expenseRecords)
      .where(inArray(expenseRecords.hospitalVisitId, ids));
    for (const row of rows) {
      if (row.hospitalVisitId != null) {
        byVisitId.set(row.hospitalVisitId, row);
      }
    }
  }
  return byVisitId;
}
