import type { RecordActor } from "@/db/schema";
import {
  hospitalVisitIdsToLink,
  type ResolvedExpenseLinks,
  resolveExpenseLinks,
  toExpenseRecordContent,
} from "../domain/expenseRecord";
import type {
  ExpenseFormFieldErrors,
  ExpenseFormInput,
} from "../domain/schema";
import { createExpenseRecordRepository } from "../infrastructure/expenseRecordRepository";

/*
 * 支出記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の
 * 両方から使う。支出の家を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export type SaveExpenseResult =
  | { id: string }
  | { fieldErrors: ExpenseFormFieldErrors }
  | { formError: string };

/**
 * 紐付ける通院記録と関連する猫を確定する（`resolveExpenseLinks`）。通院記録・関連する猫は
 * 支出の家の猫のものに限る
 */
async function resolveLinks(
  repository: ReturnType<typeof createExpenseRecordRepository>,
  householdId: string,
  data: ExpenseFormInput,
  expenseId: string | null,
): Promise<ResolvedExpenseLinks> {
  const hospitalVisitIds = hospitalVisitIdsToLink(data);
  const links = resolveExpenseLinks(
    data,
    expenseId,
    hospitalVisitIds,
    await repository.findHospitalVisitLinkCandidates(
      householdId,
      hospitalVisitIds,
    ),
  );
  if (!links.ok) {
    return links;
  }
  if (!(await repository.allCatsInHousehold(householdId, links.catIds))) {
    return {
      ok: false,
      fieldErrors: {
        catIds: ["関連するねこが見つかりませんでした。選び直してください"],
      },
    };
  }
  return links;
}

/** 家の支出記録を追加する。関連する猫・通院記録は同じ家のものに限る */
export async function createExpense(
  householdId: string,
  data: ExpenseFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<SaveExpenseResult> {
  const repository = createExpenseRecordRepository(d1);
  const links = await resolveLinks(repository, householdId, data, null);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }
  const id = await repository.add(
    householdId,
    toExpenseRecordContent(data),
    links,
    actor,
  );
  return { id };
}

/** 家の支出記録を更新する。関連する猫・通院記録は入れ直す */
export async function updateExpense(
  householdId: string,
  id: string,
  data: ExpenseFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<SaveExpenseResult> {
  const repository = createExpenseRecordRepository(d1);
  if (!(await repository.findForHousehold(householdId, id))) {
    return { formError: "支出記録が見つかりませんでした" };
  }

  const links = await resolveLinks(repository, householdId, data, id);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }

  await repository.update(
    householdId,
    id,
    toExpenseRecordContent(data),
    links,
    actor,
  );
  return { id };
}

/**
 * 家の支出記録を論理削除する（削除日時を入れ、一覧・集計から除く）。通院記録との紐付けは外す。
 * 紐付く写真（R2 のオブジェクトと media_assets 行）は消さずに残す。見つからなければ false
 */
export async function deleteExpense(
  householdId: string,
  id: string,
  actor: RecordActor,
  d1?: D1Database,
): Promise<boolean> {
  const repository = createExpenseRecordRepository(d1);
  if (!(await repository.findForHousehold(householdId, id))) return false;
  await repository.remove(id, actor);
  return true;
}
