import { and, eq, isNull } from "drizzle-orm";
import { chunk, D1_MAX_BOUND_PARAMETERS } from "@/db/batch";
import type { getDb } from "@/db/client";
import {
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
} from "@/db/schema";

type Db = ReturnType<typeof getDb>;

/** 1 行につき支出 ID と猫 ID の 2 パラメーターを使う。 */
export function insertExpenseCats(
  db: Db,
  expenseRecordId: string,
  catIds: string[],
) {
  return chunk(catIds, Math.floor(D1_MAX_BOUND_PARAMETERS / 2)).map((ids) =>
    db
      .insert(expenseRecordCats)
      .values(ids.map((catId) => ({ expenseRecordId, catId }))),
  );
}

/** 1 行につき支出 ID と通院記録 ID の 2 パラメーターを使う。 */
export function insertExpenseHospitalVisits(
  db: Db,
  expenseRecordId: string,
  hospitalVisitIds: string[],
) {
  return chunk(hospitalVisitIds, Math.floor(D1_MAX_BOUND_PARAMETERS / 2)).map(
    (ids) =>
      db
        .insert(expenseRecordHospitalVisits)
        .values(
          ids.map((hospitalVisitId) => ({ expenseRecordId, hospitalVisitId })),
        ),
  );
}

/**
 * 支出記録を論理削除する文。同じ batch 内で実行する。
 * 関連する猫（`expense_record_cats`）と添付の写真は記録の中身として残し、
 * 通院記録とは病院代としての紐付けだけを外す（通院記録は残す）
 */
export function deleteExpenseStatements(db: Db, id: string) {
  return [
    db
      .delete(expenseRecordHospitalVisits)
      .where(eq(expenseRecordHospitalVisits.expenseRecordId, id)),
    db
      .update(expenseRecords)
      .set({ deletedAt: new Date() })
      .where(and(eq(expenseRecords.id, id), isNull(expenseRecords.deletedAt))),
  ] as const;
}
