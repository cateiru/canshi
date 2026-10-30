import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { expenseRecords, hospitalVisits, symptoms } from "@/db/schema";
import { saveHospitalVisitWithExpense } from "@/features/expenses/hospitalVisitExpense";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import type { HospitalVisitFormInput } from "./schema";

/*
 * 通院記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export type SaveHospitalVisitResult = { id: string } | { error: string };

/** 通院した猫。ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照） */
type HospitalVisitCat = { id: string; householdId: string };

async function verifySymptomBelongsToCat(
  db: ReturnType<typeof getDb>,
  symptomId: string | undefined,
  catId: string,
): Promise<boolean> {
  if (symptomId == null) {
    return true;
  }
  const [row] = await db
    .select({ id: symptoms.id })
    .from(symptoms)
    .where(and(eq(symptoms.id, symptomId), eq(symptoms.catId, catId)))
    .limit(1);
  return row != null;
}

/**
 * 通院記録の作成時に紐付ける既存の支出記録が、通院する猫の家の、受診日と同じ日の
 * カテゴリ「病院」の支出記録であることを確かめる
 */
async function verifyLinkableExpense(
  db: ReturnType<typeof getDb>,
  householdId: string,
  expenseRecordId: string | undefined,
  visitedDate: string,
): Promise<boolean> {
  if (expenseRecordId == null) {
    return true;
  }
  const [row] = await db
    .select({
      category: expenseRecords.category,
      spentAt: expenseRecords.spentAt,
    })
    .from(expenseRecords)
    .where(
      and(
        eq(expenseRecords.id, expenseRecordId),
        eq(expenseRecords.householdId, householdId),
      ),
    )
    .limit(1);
  return (
    row != null &&
    row.category === "hospital" &&
    splitDateTimeUtc(row.spentAt).date === visitedDate
  );
}

function buildValues(data: HospitalVisitFormInput) {
  return {
    symptomId: data.symptomId ?? null,
    visitedAt: combineDateTimeUtc(data.visitedDate, data.visitedTime),
    reason: data.reason,
    diagnosis: data.diagnosis ?? null,
    examinationResults: data.examinationResults ?? null,
    treatment: data.treatment ?? null,
    nextVisitAt:
      data.nextVisitDate != null && data.nextVisitTime != null
        ? combineDateTimeUtc(data.nextVisitDate, data.nextVisitTime)
        : null,
    memo: data.memo ?? null,
  };
}

/** 通院記録を追加する。病院代を入力した場合は支出記録も作る */
export async function createHospitalVisit(
  cat: HospitalVisitCat,
  data: HospitalVisitFormInput,
  d1?: D1Database,
): Promise<SaveHospitalVisitResult> {
  const db = getDb(d1);
  const catId = cat.id;
  if (!(await verifySymptomBelongsToCat(db, data.symptomId, catId))) {
    return { error: "関連する症状が見つかりませんでした" };
  }
  // 病院代を入力した場合は新しい支出記録を作るため、既存の支出記録には紐付けない
  const linkExpenseRecordId =
    data.expenseAmountYen == null ? data.linkExpenseRecordId : undefined;
  if (
    !(await verifyLinkableExpense(
      db,
      cat.householdId,
      linkExpenseRecordId,
      data.visitedDate,
    ))
  ) {
    return {
      error: "紐付ける支出記録が見つかりませんでした。もう一度保存してください",
    };
  }

  const values = buildValues(data);
  const id = crypto.randomUUID();
  await saveHospitalVisitWithExpense(
    db,
    db.insert(hospitalVisits).values({ id, catId, ...values }),
    {
      hospitalVisitId: id,
      catId,
      householdId: cat.householdId,
      visitedAt: values.visitedAt,
      amountYen: data.expenseAmountYen ?? null,
      linkExpenseRecordId,
    },
  );
  return { id };
}

/**
 * 猫の通院記録を更新する。病院代を変えたら支出記録も更新し、空にしたら削除する
 * （`saveHospitalVisitWithExpense` 参照）
 */
export async function updateHospitalVisit(
  cat: HospitalVisitCat,
  id: string,
  data: HospitalVisitFormInput,
  d1?: D1Database,
): Promise<SaveHospitalVisitResult> {
  const db = getDb(d1);
  const catId = cat.id;
  if (!(await verifySymptomBelongsToCat(db, data.symptomId, catId))) {
    return { error: "関連する症状が見つかりませんでした" };
  }

  const [existing] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
    .limit(1);

  if (!existing) {
    return { error: "通院記録が見つかりませんでした" };
  }

  const values = buildValues(data);
  await saveHospitalVisitWithExpense(
    db,
    db
      .update(hospitalVisits)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId))),
    {
      hospitalVisitId: id,
      catId,
      householdId: cat.householdId,
      visitedAt: values.visitedAt,
      amountYen: data.expenseAmountYen ?? null,
      // 既存の支出記録へ紐付けて作成した後の再送信では、紐付けた支出記録を削除せずに残す
      keepLinkedExpenseRecordId: data.linkExpenseRecordId,
    },
  );
  return { id };
}
