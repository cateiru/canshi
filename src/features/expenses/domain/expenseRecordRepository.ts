import type {
  ExpenseLinks,
  ExpenseRecord,
  ExpenseRecordContent,
  HospitalVisitLinkCandidate,
} from "./expenseRecord";

/**
 * 支出記録の保存先。どの操作も家（`householdId`）で絞り、別の家の支出記録には触れない。
 * 実装は `../infrastructure/expenseRecordRepository.ts`
 */
export interface ExpenseRecordRepository {
  /** 家の支出記録のカテゴリと支出日を読む。見つからなければ null */
  findForHousehold(
    householdId: string,
    id: string,
  ): Promise<Pick<ExpenseRecord, "id" | "category" | "spentAt"> | null>;
  /** 指定した通院記録のうち、家の猫のものを読む */
  findHospitalVisitLinkCandidates(
    householdId: string,
    hospitalVisitIds: string[],
  ): Promise<HospitalVisitLinkCandidate[]>;
  /** 指定した猫がすべて存在し、家の猫か */
  allCatsInHousehold(householdId: string, catIds: string[]): Promise<boolean>;
  /** 支出記録を追加し、その ID を返す */
  add(
    householdId: string,
    content: ExpenseRecordContent,
    links: ExpenseLinks,
  ): Promise<string>;
  /** 支出記録を書き換え、関連する猫・通院記録を入れ直す */
  update(
    householdId: string,
    id: string,
    content: ExpenseRecordContent,
    links: ExpenseLinks,
  ): Promise<void>;
  /** 支出記録を、猫・通院記録との紐付けごと削除する。通院記録は残す */
  remove(id: string): Promise<void>;
}
