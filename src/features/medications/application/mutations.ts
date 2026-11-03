import { createHospitalVisitRepository } from "@/features/hospital-visits/infrastructure/hospitalVisitRepository";
import { deleteMediaAssetsByRecord } from "@/features/media/infrastructure/storage";
import { getNaiveUtcNow } from "@/features/shared/datetime";
import { createSymptomRepository } from "@/features/symptoms/infrastructure/symptomRepository";
import { MEDICATION_MEDIA_TYPE } from "../domain/media";
import { toMedicationContent } from "../domain/medication";
import type { MedicationFormInput } from "../domain/schema";
import { createMedicationRepository } from "../infrastructure/medicationRepository";

/*
 * 服薬予定の保存（ユースケース）。猫を参照できるかは呼び出し側で確かめる。
 * ほかの記録の mutations と揃えて、D1 は引数でも受け取れるようにする
 */

export const MEDICATION_REFERENCE_NOT_FOUND_ERROR =
  "関連する症状・通院記録が見つかりませんでした";

export type SaveMedicationResult = { id: string } | { error: string };

async function verifyReferencesBelongToCat(
  refs: { symptomId?: string; hospitalVisitId?: string },
  catId: string,
  d1?: D1Database,
): Promise<boolean> {
  if (
    refs.symptomId != null &&
    !(await createSymptomRepository(d1).existsForCat(catId, refs.symptomId))
  ) {
    return false;
  }
  if (
    refs.hospitalVisitId != null &&
    !(await createHospitalVisitRepository(d1).existsForCat(
      catId,
      refs.hospitalVisitId,
    ))
  ) {
    return false;
  }
  return true;
}

/**
 * 服薬予定を追加し、その ID を返す。関連する症状・通院記録がこの猫のものでなければ
 * 追加せずにエラーを返す
 */
export async function createMedication(
  catId: string,
  data: MedicationFormInput,
  d1?: D1Database,
): Promise<SaveMedicationResult> {
  if (!(await verifyReferencesBelongToCat(data, catId, d1))) {
    return { error: MEDICATION_REFERENCE_NOT_FOUND_ERROR };
  }
  const id = await createMedicationRepository(d1).add(
    catId,
    toMedicationContent(data),
  );
  return { id };
}

/**
 * 猫の服薬予定を更新する。関連する症状・通院記録がこの猫のものでなければ
 * 更新せずにエラーを、服薬予定が見つからなければ null を返す
 */
export async function updateMedication(
  catId: string,
  id: string,
  data: MedicationFormInput,
  d1?: D1Database,
): Promise<SaveMedicationResult | null> {
  if (!(await verifyReferencesBelongToCat(data, catId, d1))) {
    return { error: MEDICATION_REFERENCE_NOT_FOUND_ERROR };
  }
  const updated = await createMedicationRepository(d1).update(
    catId,
    id,
    toMedicationContent(data),
  );
  return updated ? { id } : null;
}

/**
 * 猫の服薬予定を、投薬実績と紐付く写真（R2 のオブジェクトと media_assets 行）ごと削除する。
 * 見つからなければ false
 */
export async function deleteMedication(
  catId: string,
  id: string,
): Promise<boolean> {
  const repository = createMedicationRepository();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  if (!(await repository.existsForCat(catId, id))) return false;
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(MEDICATION_MEDIA_TYPE, id);
  await repository.remove(catId, id);
  return true;
}

/**
 * 服薬予定を手動で服薬歴に移す（`archived` が true）、または服薬予定に戻す（false）
 */
export async function setMedicationArchived(
  catId: string,
  id: string,
  archived: boolean,
  d1?: D1Database,
): Promise<void> {
  // 発生日時と同じく、JST の見た目の数字を UTC として保存する（src/features/shared/datetime.ts）
  await createMedicationRepository(d1).setArchivedAt(
    catId,
    id,
    archived ? getNaiveUtcNow() : null,
  );
}
