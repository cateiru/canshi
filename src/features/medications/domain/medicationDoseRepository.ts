import type { MedicationDoseContent } from "./medicationDose";

/**
 * 投薬実績の保存先。どの操作も猫（`catId`）と服薬予定（`medicationId`）で絞る。
 * 実装は `../infrastructure/medicationDoseRepository.ts`
 */
export interface MedicationDoseRepository {
  /** 投薬実績を追加し、その ID を返す。服薬予定が猫のものかは呼び出し側で確かめる */
  add(
    catId: string,
    medicationId: string,
    content: MedicationDoseContent,
  ): Promise<string>;
  /** 投薬実績を書き換える。見つからなければ false */
  update(
    catId: string,
    medicationId: string,
    id: string,
    content: MedicationDoseContent,
  ): Promise<boolean>;
  /** 投薬実績を削除する。見つからなければ false */
  remove(catId: string, medicationId: string, id: string): Promise<boolean>;
}
