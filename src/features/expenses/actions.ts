"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { cats, expenseRecordCats, expenseRecords } from "@/db/schema";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { EXPENSE_MEDIA_TYPE } from "./media";
import { type ExpenseFormFieldErrors, expenseFormSchema } from "./schema";
import { deleteExpenseStatements, insertExpenseCats } from "./storage";

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
  });
}

async function verifyCatsExist(
  db: ReturnType<typeof getDb>,
  catIds: string[],
): Promise<boolean> {
  for (const ids of chunkForBoundParameters(catIds)) {
    const rows = await db
      .select({ id: cats.id })
      .from(cats)
      .where(inArray(cats.id, ids));
    if (rows.length !== ids.length) return false;
  }
  return true;
}

function buildValues(data: ReturnType<typeof expenseFormSchema.parse>) {
  return {
    // 支出は日付だけを入力するため、時刻は 00:00（UTC）で固定する
    spentAt: combineDateTimeUtc(data.spentDate, "00:00"),
    amountYen: data.amountYen,
    category: data.category,
    memo: data.memo ?? null,
  };
}

export async function createExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const { catIds } = parsed.data;
  if (!(await verifyCatsExist(db, catIds))) {
    return {
      fieldErrors: {
        catIds: ["関連する猫が見つかりませんでした。選び直してください"],
      },
    };
  }

  const id = crypto.randomUUID();
  const insertRecord = db
    .insert(expenseRecords)
    .values({ id, ...buildValues(parsed.data) });

  await db.batch([insertRecord, ...insertExpenseCats(db, id, catIds)]);

  const mediaError = await syncRecordMediaFromForm(
    EXPENSE_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function updateExpenseAction(
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const { catIds } = parsed.data;
  if (!(await verifyCatsExist(db, catIds))) {
    return {
      fieldErrors: {
        catIds: ["関連する猫が見つかりませんでした。選び直してください"],
      },
    };
  }
  const [existing] = await db
    .select({ id: expenseRecords.id })
    .from(expenseRecords)
    .where(eq(expenseRecords.id, id))
    .limit(1);

  if (!existing) {
    return { formError: "支出記録が見つかりませんでした" };
  }

  // 紐付く猫は差分更新せず、いったん全削除してから選択されたものを入れ直す
  const updateRecord = db
    .update(expenseRecords)
    .set({ ...buildValues(parsed.data), updatedAt: new Date() })
    .where(eq(expenseRecords.id, id));
  const deleteLinks = db
    .delete(expenseRecordCats)
    .where(eq(expenseRecordCats.expenseRecordId, id));

  await db.batch([
    updateRecord,
    deleteLinks,
    ...insertExpenseCats(db, id, catIds),
  ]);

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
  const db = getDb();
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, id);
  await db.batch(deleteExpenseStatements(db, id));
  redirect(`/cats/${catId}/expenses`);
}
