"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { expenseRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import {
  type LinkableHospitalVisit,
  listHospitalVisitsOnDate,
} from "@/features/hospital-visits/queries";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { EXPENSE_MEDIA_TYPE } from "./media";
import { createExpense, updateExpense } from "./mutations";
import {
  type HospitalExpenseCandidate,
  listHospitalExpensesOnDate,
} from "./queries";
import { type ExpenseFormFieldErrors, expenseFormSchema } from "./schema";
import { deleteExpenseStatements } from "./storage";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type ExpenseFormState = MediaFormState & {
  fieldErrors?: ExpenseFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return expenseFormSchema.safeParse({
    spentDate: formData.get("spentDate"),
    amountYen: formData.get("amountYen"),
    category: formData.get("category"),
    memo: formData.get("memo"),
    catIds: formData.getAll("catIds"),
    hospitalVisitIds: formData.getAll("hospitalVisitIds"),
  });
}

/**
 * 導線になっている猫にログイン中のユーザーがアクセスできることを確認し、その猫の家の ID を返す。
 * 支出は家に属し、記録したページの猫の家の支出として扱うため、家はクライアントから受け取らない
 */
async function requireExpenseHousehold(catId: string): Promise<string> {
  const { cat } = await requireCatAccess(catId);
  // ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照）
  return cat.householdId as string;
}

/** `catId` は記録したページの猫。支出はその猫の家に属する */
export async function createExpenseAction(
  catId: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const saved = await createExpense(householdId, parsed.data);
  if (!("id" in saved)) {
    return saved;
  }

  const mediaError = await syncRecordMediaFromForm(
    EXPENSE_MEDIA_TYPE,
    saved.id,
    formData,
  );
  return { savedRecordId: saved.id, formError: mediaError };
}

/** `catId` は編集しているページの猫。その猫の家の支出記録だけを編集できる */
export async function updateExpenseAction(
  catId: string,
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const saved = await updateExpense(householdId, id, parsed.data);
  if (!("id" in saved)) {
    return saved;
  }

  const mediaError = await syncRecordMediaFromForm(
    EXPENSE_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteExpenseAction(
  catId: string,
  id: string,
): Promise<void> {
  const householdId = await requireExpenseHousehold(catId);
  const db = getDb();
  const [existing] = await db
    .select({ id: expenseRecords.id })
    .from(expenseRecords)
    .where(
      and(
        eq(expenseRecords.id, id),
        eq(expenseRecords.householdId, householdId),
      ),
    )
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/expenses`, "replace");
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, id);
  await db.batch(deleteExpenseStatements(db, id));
  redirect(`/cats/${catId}/expenses`, "replace");
}

const dateSchema = z.string().date();

/**
 * 支出記録のフォームで、支出日と同じ日の、ページの猫の家の通院記録（紐付けの候補）を取得する。
 * 編集中の支出記録の ID を渡すと、すでに紐付いている通院記録も含める。
 * 日付を変えるたびにクライアントから呼ぶ読み取り専用の Action
 */
export async function listLinkableHospitalVisitsAction(
  catId: string,
  date: string,
  expenseRecordId?: string,
): Promise<LinkableHospitalVisit[]> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) {
    return [];
  }
  return listHospitalVisitsOnDate(householdId, parsed.data, expenseRecordId);
}

/**
 * 通院記録のフォームで、受診日と同じ日の、通院する猫の家のカテゴリ「病院」の支出記録
 * （紐付けの候補）を取得する。通院記録の作成時にクライアントから呼ぶ読み取り専用の Action
 */
export async function listSameDayHospitalExpensesAction(
  catId: string,
  date: string,
): Promise<HospitalExpenseCandidate[]> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) {
    return [];
  }
  return listHospitalExpensesOnDate(householdId, parsed.data);
}
