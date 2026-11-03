"use server";

import { redirect } from "next/navigation";
import { requireCatAccess } from "@/features/auth/presentation/session";
import { syncRecordMediaFromForm } from "@/features/media/presentation/attach";
import type { MediaFormState } from "@/features/media/presentation/useMediaFormAction";
import {
  createMemoRecord,
  deleteMemoRecord,
  updateMemoRecord,
} from "../application/mutations";
import { MEMO_RECORD_MEDIA_TYPE } from "../domain/media";
import {
  type MemoRecordFormFieldErrors,
  memoRecordFormSchema,
} from "../domain/schema";

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
  await deleteMemoRecord(catId, id);
  redirect(`/cats/${catId}/memo-records`, "replace");
}
