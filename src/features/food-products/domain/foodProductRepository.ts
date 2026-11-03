import type { FoodProductContent } from "./foodProduct";

/**
 * ごはん商品の保存先。どの操作も、ユーザーが家のメンバーであることを同じ文の中で確かめる
 * （確認から書き込みまでの間に家から外された場合に、書き込みが通らないようにするため）。
 * 実装は `../infrastructure/foodProductRepository.ts`
 */
export interface FoodProductRepository {
  /** 家の商品を追加し、その ID を返す。ユーザーが家のメンバーでなければ追加せずに null */
  addForMember(
    userId: string,
    householdId: string,
    content: FoodProductContent,
  ): Promise<string | null>;
  /** ユーザーが所属する家の商品を書き換える。別の家の商品・見つからなければ false */
  updateForMember(
    userId: string,
    id: string,
    content: FoodProductContent,
  ): Promise<boolean>;
  /** ユーザーが所属する家の商品を削除する。別の家の商品・見つからなければ false */
  removeForMember(userId: string, id: string): Promise<boolean>;
}
