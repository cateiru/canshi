"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { memoRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { MEMO_RECORD_MEDIA_TYPE } from "./media";
import { createMemoRecord, updateMemoRecord } from "./mutations";
import { type MemoRecordFormFieldErrors, memoRecordFormSchema } from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。画像はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type MemoRecordFormState = MediaFormState & {
  fieldErrors?: MemoRecordFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return memoRecordFormSchema.safeParse({
    hasDate: formData.get("hasDate"),
    recordedDate: formData.get("recordedDate"),
    recordedTime: formData.get("recordedTime"),
    content: formData.get("content"),
  });
}

export async function createMemoRecordAction(
  catId: string,
  _prevState: MemoRecordFormState,
  formData: FormData,
): Promise<MemoRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const id = await createMemoRecord(catId, parsed.data);

  const mediaError = await syncRecordMediaFromForm(
    MEMO_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function updateMemoRecordAction(
  catId: string,
  id: string,
  _prevState: MemoRecordFormState,
  formData: FormData,
): Promise<MemoRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updateMemoRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  const mediaError = await syncRecordMediaFromForm(
    MEMO_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteMemoRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: memoRecords.id })
    .from(memoRecords)
    .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)))
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/memo-records`, "replace");
  // 紐付く画像（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(MEMO_RECORD_MEDIA_TYPE, id);
  await db
    .delete(memoRecords)
    .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)));
  redirect(`/cats/${catId}/memo-records`, "replace");
}
