import type { CatValues, NewCatValues } from "./cat";

/**
 * 猫の保存先。書き込みは、ユーザーが家のメンバーであることを同じ文の中で確かめる
 * （確認から書き込みまでの間に家から外された場合に、書き込みが通らないようにするため）。
 * 実装は `../infrastructure/catRepository.ts`
 */
export interface CatRepository {
  /** 猫を登録し、その ID を返す。ユーザーが登録先の家のメンバーでなければ null */
  addForMember(userId: string, values: NewCatValues): Promise<string | null>;
  /**
   * 猫のプロフィールを書き換える。猫を飼う家は変えない。
   * ユーザーが猫の家に所属していない・猫が見つからなければ false
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
