import type { MedicationDoseFormInput } from "../domain/doseSchema";
import { toMedicationDoseContent } from "../domain/medicationDose";
import { createMedicationDoseRepository } from "../infrastructure/medicationDoseRepository";
import { createMedicationRepository } from "../infrastructure/medicationRepository";

/*
 * 投薬実績の保存（ユースケース）。画面（`../presentation/doseActions.ts`）と AI との接続（MCP）の
 * 両方から使う。猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/**
 * 投薬実績を追加し、その ID を返す。服薬予定が猫のものでなければ null。
 * 服薬予定の ID は URL・AI から任意の値を渡せるため、他猫の服薬予定に投薬実績が
 * 紐付いてしまうのを防ぐ
 */
export async function createMedicationDose(
  catId: string,
  medicationId: string,
  data: MedicationDoseFormInput,
  d1?: D1Database,
): Promise<string | null> {
  if (
    !(await createMedicationRepository(d1).existsForCat(catId, medicationId))
  ) {
    return null;
  }
  return createMedicationDoseRepository(d1).add(
    catId,
    medicationId,
    toMedicationDoseContent(data),
  );
}

/** 猫の服薬予定の投薬実績を更新する。見つからなければ false */
export async function updateMedicationDose(
  catId: string,
  medicationId: string,
  id: string,
  data: MedicationDoseFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createMedicationDoseRepository(d1).update(
    catId,
    medicationId,
    id,
    toMedicationDoseContent(data),
  );
}

/** 薬の投薬記録を削除する。見つからなければ false */
export async function deleteMedicationDose(
  catId: string,
  medicationId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createMedicationDoseRepository(d1).remove(catId, medicationId, id);
}
