import { createHospitalVisitRepository } from "@/features/hospital-visits/infrastructure/hospitalVisitRepository";
import { getNaiveUtcNow } from "@/features/shared/datetime";
import { createSymptomRepository } from "@/features/symptoms/infrastructure/symptomRepository";
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
  // 確認の後に関連する症状・通院記録が削除された場合は、追加の文の中で断られる
  return id == null ? { error: MEDICATION_REFERENCE_NOT_FOUND_ERROR } : { id };
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
 * 猫の服薬予定を、投薬実績ごと論理削除する（削除日時を入れ、一覧・タイムラインから除く）。
 * 紐付く写真（R2 のオブジェクトと media_assets 行）は消さずに残す。見つからなければ false
 */
export async function deleteMedication(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  const repository = createMedicationRepository(d1);
  if (!(await repository.existsForCat(catId, id))) return false;
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
