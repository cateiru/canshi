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
  /** 通院記録を病院代とあわせて追加し、その ID を返す */
  add(
    catId: string,
    content: HospitalVisitContent,
    expense: HospitalVisitExpenseChange,
  ): Promise<string>;
  /** 通院記録を病院代とあわせて書き換える */
  update(
    catId: string,
    id: string,
    content: HospitalVisitContent,
    expense: HospitalVisitExpenseChange,
  ): Promise<void>;
  /**
   * 通院記録を削除する。症状・投薬・支出記録からの紐付けは外し、それらの記録は残す
   */
  remove(catId: string, id: string): Promise<void>;
}
