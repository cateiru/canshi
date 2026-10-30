import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  feedingPresetItems,
  feedingPresets,
  householdMembers,
  type NewFeedingPresetItem,
} from "@/db/schema";
import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "@/features/cats/mutations";
import { listFoodProductsByIds } from "@/features/food-products/queries";
import { isHouseholdMemberCondition } from "@/features/households/queries";
import type { FeedingPresetFormInput } from "./schema";

/*
 * ごはんプリセットの保存・削除。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 家のメンバーであることは文の中で確かめる。MCP は Next.js（OpenNext）の外で動き
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
  input: FeedingPresetFormInput,
  d1?: D1Database,
) {
  const foodProductIds = [
    ...new Set(input.items.map((item) => item.foodProductId)),
  ];
  const products = await listFoodProductsByIds(householdId, foodProductIds, d1);
  return products.length === foodProductIds.length;
}

/** ユーザーが所属する家のプリセットであれば、その家の ID を返す */
async function getPresetHouseholdId(
  db: ReturnType<typeof getDb>,
  userId: string,
  id: string,
): Promise<string | null> {
  const [row] = await db
    .select({ householdId: feedingPresets.householdId })
    .from(feedingPresets)
    .innerJoin(
      householdMembers,
      eq(feedingPresets.householdId, householdMembers.householdId),
    )
    .where(and(eq(feedingPresets.id, id), eq(householdMembers.userId, userId)))
    .limit(1);
  return row?.householdId ?? null;
}

/** `userId` が家のメンバーであるときだけ 1 行を返す、INSERT ... SELECT の取得元 */
function memberRow(householdId: string, userId: string) {
  return and(
    eq(householdMembers.householdId, householdId),
    eq(householdMembers.userId, userId),
  );
}

// 判定と書き込みの間に家から外された場合に明細だけが書き換わらないよう、明細は 1 行ずつ
// INSERT ... SELECT にし、プリセットの家のメンバーの行があるときだけ挿入する。1 行ずつのため
// D1 のバインド上限も超えない。呼び出し側で同じ batch に並べて原子性を保つ。
// INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
function insertPresetItems(
  db: ReturnType<typeof getDb>,
  presetId: string,
  householdId: string,
  userId: string,
  input: FeedingPresetFormInput,
) {
  return toPresetItemValues(presetId, input).map((item) =>
    db.insert(feedingPresetItems).select((qb) =>
      qb
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          presetId: sql`${item.presetId}`.as("preset_id"),
          foodProductId: sql`${item.foodProductId}`.as("food_product_id"),
          givenAmountG: sql`${item.givenAmountG ?? null}`.as("given_amount_g"),
          givenAmountLevel: sql`${item.givenAmountLevel ?? null}`.as(
            "given_amount_level",
          ),
          sortOrder: sql`${item.sortOrder ?? 0}`.as("sort_order"),
        })
        .from(householdMembers)
        .where(memberRow(householdId, userId)),
    ),
  );
}

function toPresetItemValues(
  presetId: string,
  input: FeedingPresetFormInput,
): NewFeedingPresetItem[] {
  if (input.mode === "approximate") {
    return input.items.map((item, index) => ({
      presetId,
      foodProductId: item.foodProductId,
      givenAmountG: null,
      givenAmountLevel: item.givenAmountLevel,
      sortOrder: index,
    }));
  }
  return input.items.map((item, index) => ({
    presetId,
    foodProductId: item.foodProductId,
    givenAmountG: item.givenAmountG,
    givenAmountLevel: null,
    sortOrder: index,
  }));
}

/** 家のプリセットを追加する。明細はその家の商品に限る。登録後に家は変えられない */
export async function createFeedingPreset(
  userId: string,
  householdId: string,
  data: FeedingPresetFormInput,
  d1?: D1Database,
): Promise<SaveFeedingPresetResult> {
  if (!(await areProductsInHousehold(householdId, data, d1))) {
    return { error: PRODUCT_NOT_FOUND_ERROR };
  }

  const db = getDb(d1);
  const presetId = crypto.randomUUID();
  const { name, mode } = data;

  // プリセットも明細と同じく、登録先の家のメンバーの行があるときだけ挿入する
  const [created] = await db.batch([
    db
      .insert(feedingPresets)
      .select((qb) =>
        qb
          .select({
            id: sql`${presetId}`.as("id"),
            householdId: householdMembers.householdId,
            name: sql`${name}`.as("name"),
            mode: sql`${mode}`.as("mode"),
            createdAt: sql`(unixepoch())`.as("created_at"),
            updatedAt: sql`(unixepoch())`.as("updated_at"),
          })
          .from(householdMembers)
          .where(memberRow(householdId, userId)),
      )
      .returning({ id: feedingPresets.id }),
    ...insertPresetItems(db, presetId, householdId, userId, data),
  ]);
  if (created.length === 0) {
    return { householdError: HOUSEHOLD_NOT_ALLOWED_ERROR };
  }
  return { id: presetId };
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
  const db = getDb(d1);
  const householdId = await getPresetHouseholdId(db, userId, id);
  if (!householdId) {
    return { error: FEEDING_PRESET_NOT_FOUND_ERROR };
  }
  if (!(await areProductsInHousehold(householdId, data, d1))) {
    return { error: PRODUCT_NOT_FOUND_ERROR };
  }

  // 最初の確認の後に家から外された場合に書き換わらないよう、更新・明細の削除と挿入の
  // いずれも、プリセットの家のメンバーであることを文の中で確かめる（家は登録後に変わらない）
  const [updated] = await db.batch([
    db
      .update(feedingPresets)
      .set({ name: data.name, mode: data.mode, updatedAt: new Date() })
      .where(
        and(
          eq(feedingPresets.id, id),
          isHouseholdMemberCondition(feedingPresets.householdId, userId),
        ),
      )
      .returning({ id: feedingPresets.id }),
    db
      .delete(feedingPresetItems)
      .where(
        and(
          eq(feedingPresetItems.presetId, id),
          isHouseholdMemberCondition(householdId, userId),
        ),
      ),
    ...insertPresetItems(db, id, householdId, userId, data),
  ]);
  if (updated.length === 0) {
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
  const db = getDb(d1);
  const householdId = await getPresetHouseholdId(db, userId, id);
  if (!householdId) {
    return false;
  }

  // 最初の確認の後に家から外された場合に削除が通らないよう、所属の確認は DELETE の WHERE にも含める
  await db.batch([
    db
      .delete(feedingPresetItems)
      .where(
        and(
          eq(feedingPresetItems.presetId, id),
          isHouseholdMemberCondition(householdId, userId),
        ),
      ),
    db
      .delete(feedingPresets)
      .where(
        and(
          eq(feedingPresets.id, id),
          isHouseholdMemberCondition(feedingPresets.householdId, userId),
        ),
      ),
  ]);
  return true;
}
