import { eq } from "drizzle-orm";
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

/** 呼び出し元で添付メディアを削除した後、同じ batch 内で実行する。 */
export function deleteExpenseStatements(db: Db, id: string) {
  return [
    db
      .delete(expenseRecordCats)
      .where(eq(expenseRecordCats.expenseRecordId, id)),
    // 通院記録は残し、病院代としての紐付けだけを外す
    db
      .delete(expenseRecordHospitalVisits)
      .where(eq(expenseRecordHospitalVisits.expenseRecordId, id)),
    db.delete(expenseRecords).where(eq(expenseRecords.id, id)),
  ] as const;
}
