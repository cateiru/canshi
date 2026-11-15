"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  requireCatAccess,
  requireWritableCatAccess,
} from "@/features/auth/presentation/session";
import { isMemorialCat } from "@/features/cats/domain/memorial";
import {
  type LinkableHospitalVisit,
  listHospitalVisitsOnDate,
} from "@/features/hospital-visits/infrastructure/queries";
import { listCatsForUser } from "@/features/households/infrastructure/queries";
import { syncRecordMediaFromForm } from "@/features/media/presentation/attach";
import type { MediaFormState } from "@/features/media/presentation/useMediaFormAction";
import { userActor } from "@/features/shared/recordActor";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "../application/mutations";
import { EXPENSE_MEDIA_TYPE } from "../domain/media";
import {
  type ExpenseFormFieldErrors,
  expenseFormSchema,
} from "../domain/schema";
import {
  getExpenseById,
  type HospitalExpenseCandidate,
  listHospitalExpensesOnDate,
} from "../infrastructure/queries";

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
 * 支出は家に属し、記録したページの猫の家の支出として扱うため、家はクライアントから受け取らない。
 * 支出を書き換えるとき（`writable`）は、メモリーへ移した猫のページからは書き換えられない
 */
async function requireExpenseHousehold(
  catId: string,
  { writable }: { writable: boolean },
) {
  const { user, cat } = writable
    ? await requireWritableCatAccess(catId)
    : await requireCatAccess(catId);
  // ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照）
  return { user, householdId: cat.householdId as string };
}

const MEMORIAL_CAT_NOT_SELECTABLE_ERROR =
  "メモリーに移したねこは、関連するねこに新しく加えられません";

/**
 * 関連する猫に、メモリーへ移した猫を新しく加えようとしていれば true。すでに関連する猫に
 * 含まれている（`currentCatIds`）メモリーの猫は、そのまま残してよい
 */
async function addsMemorialCat(
  userId: string,
  catIds: readonly string[],
  currentCatIds: readonly string[] = [],
) {
  const cats = await listCatsForUser(userId);
  return cats.some(
    (cat) =>
      isMemorialCat(cat) &&
      catIds.includes(cat.id) &&
      !currentCatIds.includes(cat.id),
  );
}

/** `catId` は記録したページの猫。支出はその猫の家に属する */
export async function createExpenseAction(
  catId: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const { user, householdId } = await requireExpenseHousehold(catId, {
    writable: true,
  });
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (await addsMemorialCat(user.id, parsed.data.catIds)) {
    return { fieldErrors: { catIds: [MEMORIAL_CAT_NOT_SELECTABLE_ERROR] } };
  }

  const saved = await createExpense(householdId, parsed.data, userActor(user));
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
  const { user, householdId } = await requireExpenseHousehold(catId, {
    writable: true,
  });
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const current = await getExpenseById(householdId, id);
  if (await addsMemorialCat(user.id, parsed.data.catIds, current?.catIds)) {
    return { fieldErrors: { catIds: [MEMORIAL_CAT_NOT_SELECTABLE_ERROR] } };
  }

  const saved = await updateExpense(
    householdId,
    id,
    parsed.data,
    userActor(user),
  );
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
  const { user, householdId } = await requireExpenseHousehold(catId, {
    writable: true,
  });
  await deleteExpense(householdId, id, userActor(user));
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
  const { householdId } = await requireExpenseHousehold(catId, {
    writable: false,
  });
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
  const { householdId } = await requireExpenseHousehold(catId, {
    writable: false,
  });
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) {
    return [];
  }
  return listHospitalExpensesOnDate(householdId, parsed.data);
}
