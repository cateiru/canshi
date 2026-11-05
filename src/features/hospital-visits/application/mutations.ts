import { isLinkableToHospitalVisit } from "@/features/expenses/domain/expenseRecord";
import { createExpenseRecordRepository } from "@/features/expenses/infrastructure/expenseRecordRepository";
import { createSymptomRepository } from "@/features/symptoms/infrastructure/symptomRepository";
import { toHospitalVisitContent } from "../domain/hospitalVisit";
import type { HospitalVisitFormInput } from "../domain/schema";
import { createHospitalVisitRepository } from "../infrastructure/hospitalVisitRepository";

/*
 * 通院記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の
 * 両方から使う。猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export type SaveHospitalVisitResult = { id: string } | { error: string };

/** 通院した猫。ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照） */
type HospitalVisitCat = { id: string; householdId: string };

async function verifySymptomBelongsToCat(
  symptomId: string | undefined,
  catId: string,
  d1?: D1Database,
): Promise<boolean> {
  if (symptomId == null) {
    return true;
  }
  return createSymptomRepository(d1).existsForCat(catId, symptomId);
}

/**
 * 通院記録の作成時に紐付ける既存の支出記録が、通院する猫の家の、受診日と同じ日の
 * カテゴリ「病院」の支出記録であることを確かめる
 */
async function verifyLinkableExpense(
  householdId: string,
  expenseRecordId: string | undefined,
  visitedDate: string,
  d1?: D1Database,
): Promise<boolean> {
  if (expenseRecordId == null) {
    return true;
  }
  const expense = await createExpenseRecordRepository(d1).findForHousehold(
    householdId,
    expenseRecordId,
  );
  return expense != null && isLinkableToHospitalVisit(expense, visitedDate);
}

/** 通院記録を追加する。病院代を入力した場合は支出記録も作る */
export async function createHospitalVisit(
  cat: HospitalVisitCat,
  data: HospitalVisitFormInput,
  d1?: D1Database,
): Promise<SaveHospitalVisitResult> {
  if (!(await verifySymptomBelongsToCat(data.symptomId, cat.id, d1))) {
    return { error: "関連する症状が見つかりませんでした" };
  }
  // 病院代を入力した場合は新しい支出記録を作るため、既存の支出記録には紐付けない
  const linkExpenseRecordId =
    data.expenseAmountYen == null ? data.linkExpenseRecordId : undefined;
  if (
    !(await verifyLinkableExpense(
      cat.householdId,
      linkExpenseRecordId,
      data.visitedDate,
      d1,
    ))
  ) {
    return {
      error: "紐付ける支出記録が見つかりませんでした。もう一度保存してください",
    };
  }

  const id = await createHospitalVisitRepository(d1).add(
    cat.id,
    toHospitalVisitContent(data),
    {
      householdId: cat.householdId,
      amountYen: data.expenseAmountYen ?? null,
      linkExpenseRecordId,
    },
  );
  // 確認の後に関連する症状が削除された場合は、追加の文の中で断られる
  return id == null ? { error: "関連する症状が見つかりませんでした" } : { id };
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
  if (!(await verifySymptomBelongsToCat(data.symptomId, cat.id, d1))) {
    return { error: "関連する症状が見つかりませんでした" };
  }

  const repository = createHospitalVisitRepository(d1);
  if (!(await repository.existsForCat(cat.id, id))) {
    return { error: "通院記録が見つかりませんでした" };
  }

  const updated = await repository.update(
    cat.id,
    id,
    toHospitalVisitContent(data),
    {
      householdId: cat.householdId,
      amountYen: data.expenseAmountYen ?? null,
      // 既存の支出記録へ紐付けて作成した後の再送信では、紐付けた支出記録を削除せずに残す
      keepLinkedExpenseRecordId: data.linkExpenseRecordId,
    },
  );
  // 確認の後に通院記録・関連する症状が削除された場合は、更新の文の中で断られる
  return updated ? { id } : { error: "通院記録が見つかりませんでした" };
}

/**
 * 猫の通院記録を論理削除する（削除日時を入れ、一覧・タイムラインから除く）。
 * 症状・投薬・支出記録からの紐付けは外し、それらの記録は残す。
 * 紐付く写真（R2 のオブジェクトと media_assets 行）は消さずに残す。見つからなければ false
 */
export async function deleteHospitalVisit(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  const repository = createHospitalVisitRepository(d1);
  if (!(await repository.existsForCat(catId, id))) return false;
  await repository.remove(catId, id);
  return true;
}
