import type { CatValues } from "./cat";

/**
 * 猫の保存先。書き込みは、ユーザーが家のメンバーであることを同じ文の中で確かめる
 * （確認から書き込みまでの間に家から外された場合に、書き込みが通らないようにするため）。
 * 実装は `../infrastructure/catRepository.ts`
 */
export interface CatRepository {
  /** 猫を登録し、その ID を返す。ユーザーが登録先の家のメンバーでなければ null */
  addForMember(userId: string, values: CatValues): Promise<string | null>;
  /**
   * 猫を書き換える。家を変えると、猫を記録ごとその家へ引っ越す。引っ越し元・引っ越し先の
   * どちらの家にもユーザーが所属している必要があり、そうでない・見つからなければ false。
   *
   * 支出記録は猫ではなく家に属するため引っ越し元の家に残し、関連する猫・通院記録は支出と同じ家の
   * ものに限るため、引っ越した猫とその通院記録との紐付けを同じ batch で外す。
   * 最後の猫が引っ越して猫のいなくなった家には、ごはんの時間の通知を残さない
   */
  updateForMember(
    userId: string,
    catId: string,
    values: CatValues,
  ): Promise<boolean>;
  /**
   * 猫を、記録・通知ごと削除する。支出記録は家計簿として残し、この猫との紐付けだけを外す。
   * 最後の猫を削除して猫のいなくなった家には、ごはんの時間の通知を残さない
   */
  removeForUser(userId: string, id: string): Promise<void>;
}
