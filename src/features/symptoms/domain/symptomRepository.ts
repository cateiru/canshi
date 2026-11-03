import type { SymptomContent } from "./symptom";

/**
 * 症状の記録の保存先。どの操作も猫（`catId`）で絞り、別の猫の記録には触れない。
 * 実装は `../infrastructure/symptomRepository.ts`
 */
export interface SymptomRepository {
  /** 猫の症状の記録があるか */
  existsForCat(catId: string, id: string): Promise<boolean>;
  /** 記録を追加し、その ID を返す */
  add(catId: string, content: SymptomContent): Promise<string>;
  /** 記録を書き換える。見つからなければ false */
  update(catId: string, id: string, content: SymptomContent): Promise<boolean>;
  /**
   * 記録を削除する。投薬・通院記録からの紐付けは外してそれらの記録は残し、
   * この症状の確認通知（`symptom_ongoing`）は削除する
   */
  remove(catId: string, id: string): Promise<void>;
}
