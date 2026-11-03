import type { MedicationContent } from "./medication";

/**
 * 服薬予定の保存先。どの操作も猫（`catId`）で絞り、別の猫の服薬予定には触れない。
 * 実装は `../infrastructure/medicationRepository.ts`
 */
export interface MedicationRepository {
  /** 猫の服薬予定があるか */
  existsForCat(catId: string, id: string): Promise<boolean>;
  /** 服薬予定を追加し、その ID を返す */
  add(catId: string, content: MedicationContent): Promise<string>;
  /** 服薬予定を書き換える。見つからなければ false */
  update(
    catId: string,
    id: string,
    content: MedicationContent,
  ): Promise<boolean>;
  /** 服薬予定を、投薬実績ごと削除する */
  remove(catId: string, id: string): Promise<void>;
  /** 服薬歴へ移した日時を設定する。null なら服薬予定に戻す */
  setArchivedAt(
    catId: string,
    id: string,
    archivedAt: Date | null,
  ): Promise<void>;
}
