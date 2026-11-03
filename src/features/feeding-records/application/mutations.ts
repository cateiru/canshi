import {
  completesFeedingNotifications,
  feedingRecordFoodProductIds,
  toFeedingRecordContent,
} from "../domain/feedingRecord";
import type { FeedingRecordFormInput } from "../domain/schema";
import { createFeedingRecordRepository } from "../infrastructure/feedingRecordRepository";

/*
 * ごはん記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の
 * 両方から使う。猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export type SaveFeedingRecordResult = { id: string } | { error: string };

/** 保存する猫。家は参照できるかを確かめた時点のもの */
type FeedingRecordCat = { id: string; householdId: string | null };

const HOUSEHOLD_CHANGED_ERROR =
  "猫の家が変わったため保存できませんでした。もう一度やり直してください";

/** 記録を追加する。明細の商品は猫の家の商品に限る */
export async function createFeedingRecord(
  cat: FeedingRecordCat,
  data: FeedingRecordFormInput,
  d1?: D1Database,
): Promise<SaveFeedingRecordResult> {
  const repository = createFeedingRecordRepository(d1);
  const householdId = cat.householdId;
  const built = toFeedingRecordContent(
    data,
    await repository.findFoodProducts(feedingRecordFoodProductIds(data)),
    householdId,
  );
  if ("error" in built) {
    return { error: built.error };
  }
  // 家のない猫は商品を選べないため、ここには来ない（型を絞るための確認）
  if (householdId == null) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }

  const id = await repository.addWhileCatInHousehold(
    cat.id,
    householdId,
    built.content,
    completesFeedingNotifications(built.content.occurredAt),
  );
  if (id == null) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }
  return { id };
}

/**
 * 猫の記録を更新する。明細の商品は猫の家の商品に限るが、その記録ですでに使っている商品は残せる
 */
export async function updateFeedingRecord(
  cat: FeedingRecordCat,
  id: string,
  data: FeedingRecordFormInput,
  d1?: D1Database,
): Promise<SaveFeedingRecordResult> {
  const repository = createFeedingRecordRepository(d1);
  const occurredAt = await repository.findOccurredAtForCat(cat.id, id);
  if (occurredAt == null) {
    return { error: "記録が見つかりませんでした" };
  }

  const householdId = cat.householdId;
  const built = toFeedingRecordContent(
    data,
    await repository.findFoodProducts(feedingRecordFoodProductIds(data)),
    householdId,
    await repository.listItemFoodProductIds(id),
  );
  if ("error" in built) {
    return { error: built.error };
  }
  // 参照できる猫は必ず家に所属している（型を絞るための確認）
  if (householdId == null) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }

  const updated = await repository.updateWhileCatInHousehold(
    cat.id,
    householdId,
    id,
    built.content,
    // 日時を変えたときは、その日時に記録したのと同じく通知を完了にする（先の日時から今以前に
    // 直したときなど）。量などだけを直したときは、過去の記録の修正で今の通知を完了にしないよう
    // 何もしない
    built.content.occurredAt.getTime() !== occurredAt.getTime() &&
      completesFeedingNotifications(built.content.occurredAt),
  );
  if (!updated) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }
  return { id };
}

/** 猫のごはん記録を明細ごと削除する。見つからなければ false */
export async function deleteFeedingRecord(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createFeedingRecordRepository(d1).remove(catId, id);
}
