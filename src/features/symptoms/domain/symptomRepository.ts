import type { SymptomContent } from "./symptom";

/**
 * 症状の記録の保存先。どの操作も猫（`catId`）で絞り、別の猫の記録には触れない。
 * 実装は `../infrastructure/symptomRepository.ts`
 */
export interface SymptomRepository {
  /** 猫の症状の記録があるか */
  existsForCat(catId: string, id: string): Promise<boolean>;
  /**
   * 記録を追加し、その ID を返す。関連する通院記録がこの猫のもので削除されていなければ追加し、
   * そうでなければ null
   */
  add(catId: string, content: SymptomContent): Promise<string | null>;
  /**
   * 記録を書き換える。見つからない・削除済み、または関連する通院記録がこの猫のもので
   * 削除されていなければ書き換えず false
   */
  update(catId: string, id: string, content: SymptomContent): Promise<boolean>;
  /**
   * 記録を論理削除する。投薬・通院記録からの紐付けは外してそれらの記録は残し、
   * この症状の確認通知（`symptom_ongoing`）は削除する
   */
  remove(catId: string, id: string): Promise<void>;
}
