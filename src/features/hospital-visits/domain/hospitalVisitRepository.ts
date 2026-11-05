import type {
  HospitalVisitContent,
  HospitalVisitExpenseChange,
} from "./hospitalVisit";

/**
 * 通院記録の保存先。どの操作も猫（`catId`）で絞り、別の猫の記録には触れない。
 * 実装は `../infrastructure/hospitalVisitRepository.ts`
 */
export interface HospitalVisitRepository {
  /** 猫の通院記録があるか */
  existsForCat(catId: string, id: string): Promise<boolean>;
  /**
   * 通院記録を病院代とあわせて追加し、その ID を返す。関連する症状がこの猫のもので削除されて
   * いなければ追加し、そうでなければ何も保存せず null
   */
  add(
    catId: string,
    content: HospitalVisitContent,
    expense: HospitalVisitExpenseChange,
  ): Promise<string | null>;
  /**
   * 通院記録を病院代とあわせて書き換える。見つからない・削除済み、または関連する症状がこの猫の
   * もので削除されていなければ何も保存せず false
   */
  update(
    catId: string,
    id: string,
    content: HospitalVisitContent,
    expense: HospitalVisitExpenseChange,
  ): Promise<boolean>;
  /**
   * 通院記録を論理削除する。症状・投薬・支出記録からの紐付けは外し、それらの記録は残す
   */
  remove(catId: string, id: string): Promise<void>;
}
