"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { vomitRecords } from "@/db/schema";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { VOMIT_RECORD_MEDIA_TYPE } from "./media";
import {
  type VomitRecordFormFieldErrors,
  vomitRecordFormSchema,
} from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type VomitRecordFormState = MediaFormState & {
  fieldErrors?: VomitRecordFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return vomitRecordFormSchema.safeParse({
    occurredDate: formData.get("occurredDate"),
    occurredTime: formData.get("occurredTime"),
    amount: formData.get("amount"),
    color: formData.get("color"),
    hasBlood: formData.get("hasBlood"),
    hasForeignObject: formData.get("hasForeignObject"),
    appetiteNote: formData.get("appetiteNote"),
    energyNote: formData.get("energyNote"),
    memo: formData.get("memo"),
  });
}

export async function createVomitRecordAction(
  catId: string,
  _prevState: VomitRecordFormState,
  formData: FormData,
): Promise<VomitRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const [created] = await db
    .insert(vomitRecords)
    .values({
      catId,
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      amount: parsed.data.amount ?? null,
      color: parsed.data.color ?? null,
      hasBlood: parsed.data.hasBlood,
      hasForeignObject: parsed.data.hasForeignObject,
      appetiteNote: parsed.data.appetiteNote ?? null,
      energyNote: parsed.data.energyNote ?? null,
      memo: parsed.data.memo ?? null,
    })
    .returning({ id: vomitRecords.id });

  const mediaError = await syncRecordMediaFromForm(
    VOMIT_RECORD_MEDIA_TYPE,
    created.id,
    formData,
  );
  return { savedRecordId: created.id, formError: mediaError };
}

export async function updateVomitRecordAction(
  catId: string,
  id: string,
  _prevState: VomitRecordFormState,
  formData: FormData,
): Promise<VomitRecordFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(vomitRecords)
    .set({
      occurredAt: combineDateTimeUtc(
        parsed.data.occurredDate,
        parsed.data.occurredTime,
      ),
      amount: parsed.data.amount ?? null,
      color: parsed.data.color ?? null,
      hasBlood: parsed.data.hasBlood,
      hasForeignObject: parsed.data.hasForeignObject,
      appetiteNote: parsed.data.appetiteNote ?? null,
      energyNote: parsed.data.energyNote ?? null,
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
    .returning({ id: vomitRecords.id });

  if (result.length === 0) {
    return { formError: "記録が見つかりませんでした" };
  }

  const mediaError = await syncRecordMediaFromForm(
    VOMIT_RECORD_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteVomitRecordAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(VOMIT_RECORD_MEDIA_TYPE, id);
  await db
    .delete(vomitRecords)
    .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)));
  redirect(`/cats/${catId}/vomit-records`);
}
