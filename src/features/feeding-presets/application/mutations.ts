import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "@/features/cats/application/mutations";
import { listFoodProductsByIds } from "@/features/food-products/infrastructure/queries";
import {
  type FeedingPresetContent,
  feedingPresetFoodProductIds,
  toFeedingPresetContent,
} from "../domain/feedingPreset";
import type { FeedingPresetFormInput } from "../domain/schema";
import { createFeedingPresetRepository } from "../infrastructure/feedingPresetRepository";

/*
 * ごはんプリセットの保存・削除（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の
 * 両方から使う。家のメンバーであることはリポジトリの文の中で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export const FEEDING_PRESET_NOT_FOUND_ERROR =
  "プリセットが見つかりませんでした";

const PRODUCT_NOT_FOUND_ERROR = "選択された商品が見つかりませんでした";

/** 家に追加できなかったときは `householdError`、それ以外の失敗は `error` */
export type SaveFeedingPresetResult =
  | { id: string }
  | { householdError: string }
  | { error: string };

/** 明細の商品がすべてプリセットと同じ家の商品であれば true */
async function areProductsInHousehold(
  householdId: string,
  content: FeedingPresetContent,
  d1?: D1Database,
) {
  const foodProductIds = feedingPresetFoodProductIds(content);
  const products = await listFoodProductsByIds(householdId, foodProductIds, d1);
  return products.length === foodProductIds.length;
}

/** 家のプリセットを追加する。明細はその家の商品に限る。登録後に家は変えられない */
export async function createFeedingPreset(
  userId: string,
  householdId: string,
  data: FeedingPresetFormInput,
  d1?: D1Database,
): Promise<SaveFeedingPresetResult> {
  const content = toFeedingPresetContent(data);
  if (!(await areProductsInHousehold(householdId, content, d1))) {
    return { error: PRODUCT_NOT_FOUND_ERROR };
  }

  const id = await createFeedingPresetRepository(d1).addForMember(
    userId,
    householdId,
    content,
  );
  if (id == null) {
    return { householdError: HOUSEHOLD_NOT_ALLOWED_ERROR };
  }
  return { id };
}

/**
 * ユーザーが所属する家のプリセットを更新する。別の家のプリセットは、存在しない
 * プリセットと区別せずに扱う
 */
export async function updateFeedingPreset(
  userId: string,
  id: string,
  data: FeedingPresetFormInput,
  d1?: D1Database,
): Promise<SaveFeedingPresetResult> {
  const repository = createFeedingPresetRepository(d1);
  const householdId = await repository.findHouseholdIdForMember(userId, id);
  if (!householdId) {
    return { error: FEEDING_PRESET_NOT_FOUND_ERROR };
  }
  const content = toFeedingPresetContent(data);
  if (!(await areProductsInHousehold(householdId, content, d1))) {
    return { error: PRODUCT_NOT_FOUND_ERROR };
  }

  // 最初の確認の後に家から外された場合は、リポジトリの文の中の確認で書き換わらない
  if (!(await repository.updateForMember(userId, householdId, id, content))) {
    return { error: FEEDING_PRESET_NOT_FOUND_ERROR };
  }
  return { id };
}

/**
 * ユーザーが所属する家のプリセットを削除する。見つからなければ false。
 * 確認の後に家から外された場合は、削除せずに true を返す（画面では一覧から消えるため）
 */
export async function deleteFeedingPreset(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  const repository = createFeedingPresetRepository(d1);
  const householdId = await repository.findHouseholdIdForMember(userId, id);
  if (!householdId) {
    return false;
  }
  await repository.removeForMember(userId, householdId, id);
  return true;
}
