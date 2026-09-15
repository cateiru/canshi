"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { cats, expenseRecordCats, expenseRecords } from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { EXPENSE_MEDIA_TYPE } from "./media";
import { type ExpenseFormFieldErrors, expenseFormSchema } from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真のアップロードと一覧への遷移は
 * クライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
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
  });
}

/**
 * 関連する猫のチェックボックス。1 匹も選ばない（どの猫にも紐付かない共通の支出）ことも許容する
 */
function parseCatIds(formData: FormData): string[] {
  return [
    ...new Set(
      formData
        .getAll("catIds")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value !== ""),
    ),
  ];
}

async function verifyCatsExist(catIds: string[]): Promise<boolean> {
  if (catIds.length === 0) {
    return true;
  }
  const db = getDb();
  const rows = await db
    .select({ id: cats.id })
    .from(cats)
    .where(inArray(cats.id, catIds));
  return rows.length === catIds.length;
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

function catLinkValues(expenseRecordId: string, catIds: string[]) {
  return catIds.map((catId) => ({ expenseRecordId, catId }));
}

export async function createExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const catIds = parseCatIds(formData);
  if (!(await verifyCatsExist(catIds))) {
    return { formError: "関連する猫が見つかりませんでした" };
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const insertRecord = db
    .insert(expenseRecords)
    .values({ id, ...buildValues(parsed.data) });

  if (catIds.length === 0) {
    await insertRecord;
  } else {
    await db.batch([
      insertRecord,
      db.insert(expenseRecordCats).values(catLinkValues(id, catIds)),
    ]);
  }

  return { savedRecordId: id };
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

  const catIds = parseCatIds(formData);
  if (!(await verifyCatsExist(catIds))) {
    return { formError: "関連する猫が見つかりませんでした" };
  }

  const db = getDb();
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

  if (catIds.length === 0) {
    await db.batch([updateRecord, deleteLinks]);
  } else {
    await db.batch([
      updateRecord,
      deleteLinks,
      db.insert(expenseRecordCats).values(catLinkValues(id, catIds)),
    ]);
  }

  return { savedRecordId: id };
}

export async function deleteExpenseAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, id);
  // expense_record_cats から expense_records への外部キー参照があるため、
  // 支出記録本体より先に紐付けを削除する
  await db.batch([
    db
      .delete(expenseRecordCats)
      .where(eq(expenseRecordCats.expenseRecordId, id)),
    db.delete(expenseRecords).where(eq(expenseRecords.id, id)),
  ]);
  redirect(`/cats/${catId}/expenses`);
}
