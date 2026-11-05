import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { getDb } from "@/db/client";
import {
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
} from "@/db/schema";

type Db = ReturnType<typeof getDb>;

/**
 * 支出記録が削除されずにあるときだけ真になる条件。支出の保存と同じ batch に並べる紐付けの文に含め、
 * 確認の後に支出が論理削除された場合に、紐付けだけが書き換わらないようにする
 * （支出の追加では、同じ batch の先頭で挿入した支出を見る）
 */
export function liveExpenseCondition(expenseRecordId: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${expenseRecords}
    WHERE ${expenseRecords.id} = ${expenseRecordId}
      AND ${expenseRecords.deletedAt} IS NULL
  )`;
}

/** 通院記録が削除されずにあるときだけ真になる条件（`liveExpenseCondition` と同じ使い方） */
export function liveHospitalVisitCondition(hospitalVisitId: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${hospitalVisits}
    WHERE ${hospitalVisits.id} = ${hospitalVisitId}
      AND ${hospitalVisits.deletedAt} IS NULL
  )`;
}

/**
 * 支出記録と猫を紐付ける文。支出が削除されずにあるときだけ挿入する。
 * 猫 ID は JSON の配列 1 つで渡すため、猫の数に関わらず D1 のバインド上限を超えない
 */
export function insertExpenseCats(
  db: Db,
  expenseRecordId: string,
  catIds: string[],
) {
  if (catIds.length === 0) {
    return [];
  }
  return [
    db.insert(expenseRecordCats).select(
      sql`SELECT ${expenseRecordId}, json_each.value FROM json_each(${JSON.stringify(catIds)})
          WHERE ${liveExpenseCondition(expenseRecordId)}`,
    ),
  ];
}

/**
 * 支出記録と通院記録（病院代）を紐付ける文。支出が削除されずにあるときだけ、削除されていない
 * 通院記録に紐付ける。通院記録 ID は `insertExpenseCats` と同じく JSON の配列 1 つで渡す
 */
export function insertExpenseHospitalVisits(
  db: Db,
  expenseRecordId: string,
  hospitalVisitIds: string[],
) {
  if (hospitalVisitIds.length === 0) {
    return [];
  }
  return [
    db.insert(expenseRecordHospitalVisits).select(
      sql`SELECT ${expenseRecordId}, json_each.value FROM json_each(${JSON.stringify(hospitalVisitIds)})
          WHERE ${liveExpenseCondition(expenseRecordId)}
            AND json_each.value IN (
              SELECT ${hospitalVisits.id} FROM ${hospitalVisits}
              WHERE ${hospitalVisits.deletedAt} IS NULL
            )`,
    ),
  ];
}

/**
 * 支出記録を論理削除する文。同じ batch 内で実行する。
 * 関連する猫（`expense_record_cats`）と添付の写真は記録の中身として残し、
 * 通院記録とは病院代としての紐付けだけを外す（通院記録は残す）。
 * `condition` を渡すと、その条件が真のときだけ削除する
 */
export function deleteExpenseStatements(db: Db, id: string, condition?: SQL) {
  return [
    db
      .delete(expenseRecordHospitalVisits)
      .where(
        and(
          eq(expenseRecordHospitalVisits.expenseRecordId, id),
          liveExpenseCondition(id),
          condition,
        ),
      ),
    db
      .update(expenseRecords)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(expenseRecords.id, id),
          isNull(expenseRecords.deletedAt),
          condition,
        ),
      ),
  ] as const;
}
