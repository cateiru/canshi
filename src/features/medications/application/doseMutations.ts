import type { RecordActor } from "@/db/schema";
import type { MedicationDoseFormInput } from "../domain/doseSchema";
import { toMedicationDoseContent } from "../domain/medicationDose";
import { createMedicationDoseRepository } from "../infrastructure/medicationDoseRepository";

/*
 * 投薬実績の保存（ユースケース）。画面（`../presentation/doseActions.ts`）と AI との接続（MCP）の
 * 両方から使う。猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/**
 * 投薬実績を追加し、その ID を返す。服薬予定が猫のものでない・削除済みなら null。
 * 服薬予定の ID は URL・AI から任意の値を渡せるため、他猫の服薬予定に投薬実績が
 * 紐付いてしまうのを防ぐ。確かめるのは挿入の文の中（`medicationDoseRepository.add`）で、
 * 確認の後に服薬予定が論理削除された場合も追加しない
 */
export async function createMedicationDose(
  catId: string,
  medicationId: string,
  data: MedicationDoseFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<string | null> {
  return createMedicationDoseRepository(d1).add(
    catId,
    medicationId,
    toMedicationDoseContent(data),
    actor,
  );
}

/** 猫の服薬予定の投薬実績を更新する。見つからなければ false */
export async function updateMedicationDose(
  catId: string,
  medicationId: string,
  id: string,
  data: MedicationDoseFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<boolean> {
  return createMedicationDoseRepository(d1).update(
    catId,
    medicationId,
    id,
    toMedicationDoseContent(data),
    actor,
  );
}

/** 薬の投薬記録を論理削除する（削除日時を入れ、一覧・タイムラインから除く）。見つからなければ false */
export async function deleteMedicationDose(
  catId: string,
  medicationId: string,
  id: string,
  actor: RecordActor,
  d1?: D1Database,
): Promise<boolean> {
  return createMedicationDoseRepository(d1).remove(
    catId,
    medicationId,
    id,
    actor,
  );
}
