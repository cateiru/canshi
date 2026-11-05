import type { MedicationDoseContent } from "./medicationDose";

/**
 * 投薬実績の保存先。どの操作も猫（`catId`）と服薬予定（`medicationId`）で絞る。
 * 実装は `../infrastructure/medicationDoseRepository.ts`
 */
export interface MedicationDoseRepository {
  /**
   * 投薬実績を追加し、その ID を返す。服薬予定がこの猫のもので、削除されていないときだけ追加し、
   * そうでなければ null（確認の後に服薬予定が論理削除された場合も追加しない）
   */
  add(
    catId: string,
    medicationId: string,
    content: MedicationDoseContent,
  ): Promise<string | null>;
  /** 投薬実績を書き換える。見つからなければ false */
  update(
    catId: string,
    medicationId: string,
    id: string,
    content: MedicationDoseContent,
  ): Promise<boolean>;
  /** 投薬実績を論理削除する。見つからない・削除済みなら false */
  remove(catId: string, medicationId: string, id: string): Promise<boolean>;
}
