import { toFoodProductContent } from "../domain/foodProduct";
import type { FoodProductFormInput } from "../domain/schema";
import { createFoodProductRepository } from "../infrastructure/foodProductRepository";

/*
 * ごはん商品の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の
 * 両方から使う。家のメンバーであることはリポジトリの文の中で確かめる。MCP は Next.js（OpenNext）の
 * 外で動き `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/**
 * 家の商品を追加し、その ID を返す。ユーザーが家のメンバーでなければ追加せずに null。
 *
 * 商品は登録時に選んだ家に属する。登録後に家は変えられない（ほかの家のプリセット・
 * ごはん記録から参照されないようにするため）
 */
export async function createFoodProduct(
  userId: string,
  householdId: string,
  values: FoodProductFormInput,
  d1?: D1Database,
): Promise<string | null> {
  return createFoodProductRepository(d1).addForMember(
    userId,
    householdId,
    toFoodProductContent(values),
  );
}

/**
 * ユーザーが所属する家の商品を更新する。別の家の商品は、存在しない商品と区別せずに false
 */
export async function updateFoodProduct(
  userId: string,
  id: string,
  values: FoodProductFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createFoodProductRepository(d1).updateForMember(
    userId,
    id,
    toFoodProductContent(values),
  );
}

/**
 * 家の商品を削除する。ユーザーが家のメンバーでない、または見つからなければ false。
 * 画像の削除と、記録・プリセットで使われていないかの確認は呼び出し側で行う
 */
export async function deleteFoodProductForUser(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createFoodProductRepository(d1).removeForMember(userId, id);
}
