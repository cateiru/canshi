"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { poopRecords } from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { POOP_RECORD_MEDIA_TYPE } from "./media";
import { createPoopRecord, updatePoopRecord } from "./mutations";
import { type PoopRecordFormFieldErrors, poopRecordFormSchema } from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type PoopRecordFormState = MediaFormState & {
  fieldErrors?: PoopRecordFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return poopRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    amount: formData.get("amount"),
    color: formData.get("color"),
    consistency: formData.get("consistency"),
    hasBlood: formData.get("hasBlood"),
    hasForeignObject: formData.get("hasForeignObject"),
    appetiteNote: formData.get("appetiteNote"),
    energyNote: formData.get("energyNote"),
    memo: formData.get("memo"),
  });
}

export async function createPoopRecordAction(
  catId: string,
  _prevState: PoopRecordFormState,
  formData: FormData,
): Promise<PoopRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const id = await createPoopRecord(catId, parsed.data);

  const mediaError = await syncRecordMediaFromForm(
    POOP_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function updatePoopRecordAction(
  catId: string,
  id: string,
  _prevState: PoopRecordFormState,
  formData: FormData,
): Promise<PoopRecordFormState> {
  await requireCatAccess(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!(await updatePoopRecord(catId, id, parsed.data))) {
    return { formError: "記録が見つかりませんでした" };
  }

  const mediaError = await syncRecordMediaFromForm(
    POOP_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deletePoopRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  await requireCatAccess(catId);
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: poopRecords.id })
    .from(poopRecords)
    .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/poop-records`, "replace");
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(POOP_RECORD_MEDIA_TYPE, id);
  await db
    .delete(poopRecords)
    .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)));
  redirect(`/cats/${catId}/poop-records`, "replace");
}
