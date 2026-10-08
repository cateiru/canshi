"use server";

import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db/client";
import {
  feedingPresetItems,
  feedingPresets,
  householdMembers,
  type NewFeedingPresetItem,
} from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "@/features/cats/mutations";
import { listFoodProductsByIds } from "@/features/food-products/queries";
import { readFormHouseholdId } from "@/features/households/formHousehold";
import { isHouseholdMemberCondition } from "@/features/households/queries";
import type { SubmitRedirect } from "@/features/navigation/types";
import { getFeedingPresetForUser } from "./queries";
import {
  type FeedingPresetFormFieldErrors,
  type FeedingPresetFormInput,
  type FeedingPresetItemFieldName,
  feedingPresetFormSchema,
} from "./schema";

export type FeedingPresetFormState = SubmitRedirect & {
  fieldErrors?: FeedingPresetFormFieldErrors & { householdId?: string[] };
  formError?: string;
};

const PRODUCT_NOT_FOUND_ERROR = "選択された商品が見つかりませんでした";

/** 明細の商品がすべてプリセットと同じ家の商品であれば true */
async function areProductsInHousehold(
  householdId: string,
  input: FeedingPresetFormInput,
) {
  const foodProductIds = [
    ...new Set(input.items.map((item) => item.foodProductId)),
  ];
  const products = await listFoodProductsByIds(householdId, foodProductIds);
  return products.length === foodProductIds.length;
}

const ITEM_FIELD_PATTERN = /^items\.(\d+)\.(.+)$/;

function parseFormData(formData: FormData) {
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const match = key.match(ITEM_FIELD_PATTERN);
    if (match) {
      indices.add(Number(match[1]));
    }
  }
  const sortedIndices = Array.from(indices).sort((a, b) => a - b);

  // フォームは選択中のモードの入力欄だけを送るため、両モードの項目をまとめて
  // 読み取り、どちらを使うかはスキーマの mode による判別に任せる
  const items = sortedIndices.map((index) => ({
    foodProductId: formData.get(`items.${index}.foodProductId`),
    givenAmountG: formData.get(`items.${index}.givenAmountG`),
    givenAmountLevel: formData.get(`items.${index}.givenAmountLevel`),
  }));

  return feedingPresetFormSchema.safeParse({
    name: formData.get("name"),
    mode: formData.get("mode"),
    items,
  });
}

// zod の flatten() はネストした配列パスを潰してしまい行ごとのエラーが
// 表示できなくなるため、issue.path を見て行ごとの itemErrors に振り分ける
function mapZodErrors(error: z.ZodError): FeedingPresetFormFieldErrors {
  const fieldErrors: FeedingPresetFormFieldErrors = {};
  const itemErrors: FeedingPresetFormFieldErrors["itemErrors"] = [];

  for (const issue of error.issues) {
    const [first, second, third] = issue.path;
    if (first === "items" && typeof second === "number" && third) {
      const fieldName = String(third) as FeedingPresetItemFieldName;
      itemErrors[second] ??= {};
      const rowErrors = itemErrors[second];
      rowErrors[fieldName] ??= [];
      rowErrors[fieldName].push(issue.message);
      continue;
    }
    if (first === "name" || first === "mode") {
      fieldErrors[first] ??= [];
      fieldErrors[first].push(issue.message);
      continue;
    }
    if (first === "items") {
      fieldErrors.items ??= [];
      fieldErrors.items.push(issue.message);
    }
  }

  if (itemErrors.some((entry) => entry != null)) {
    fieldErrors.itemErrors = itemErrors;
  }

  return fieldErrors;
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

export async function createFeedingPresetAction(
  _prevState: FeedingPresetFormState,
  formData: FormData,
): Promise<FeedingPresetFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  // プリセットは登録時に選んだ家に属し、明細はその家の商品に限る。登録後に家は変えられない
  const householdId = readFormHouseholdId(formData);
  if (!householdId) {
    return { fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] } };
  }
  if (!(await areProductsInHousehold(householdId, parsed.data))) {
    return { formError: PRODUCT_NOT_FOUND_ERROR };
  }

  const db = getDb();
  const presetId = crypto.randomUUID();
  const { name, mode } = parsed.data;

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
          .where(memberRow(householdId, user.id)),
      )
      .returning({ id: feedingPresets.id }),
    ...insertPresetItems(db, presetId, householdId, user.id, parsed.data),
  ]);
  if (created.length === 0) {
    return { fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] } };
  }

  return { redirectTo: "/feeding-presets" };
}

export async function updateFeedingPresetAction(
  id: string,
  _prevState: FeedingPresetFormState,
  formData: FormData,
): Promise<FeedingPresetFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: mapZodErrors(parsed.error) };
  }

  // 別の家のプリセットは、存在しないプリセットと区別せずに扱う
  const existing = await getFeedingPresetForUser(user.id, id);
  if (!existing) {
    return { formError: "プリセットが見つかりませんでした" };
  }
  if (!(await areProductsInHousehold(existing.householdId, parsed.data))) {
    return { formError: PRODUCT_NOT_FOUND_ERROR };
  }

  // 最初の確認の後に家から外された場合に書き換わらないよう、更新・明細の削除と挿入の
  // いずれも、プリセットの家のメンバーであることを文の中で確かめる（家は登録後に変わらない）
  const db = getDb();
  const [updated] = await db.batch([
    db
      .update(feedingPresets)
      .set({
        name: parsed.data.name,
        mode: parsed.data.mode,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedingPresets.id, id),
          isHouseholdMemberCondition(feedingPresets.householdId, user.id),
        ),
      )
      .returning({ id: feedingPresets.id }),
    db
      .delete(feedingPresetItems)
      .where(
        and(
          eq(feedingPresetItems.presetId, id),
          isHouseholdMemberCondition(existing.householdId, user.id),
        ),
      ),
    ...insertPresetItems(db, id, existing.householdId, user.id, parsed.data),
  ]);
  if (updated.length === 0) {
    return { formError: "プリセットが見つかりませんでした" };
  }

  return { redirectTo: "/feeding-presets" };
}

export type DeleteFeedingPresetResult = { error?: string };

// この Action は redirect せず、成功/失敗のどちらも戻り値で表現する。
// 呼び出し側（クライアントコンポーネント）が結果を待ち受けて画面更新を行うため
export async function deleteFeedingPresetAction(
  id: string,
): Promise<DeleteFeedingPresetResult> {
  const user = await requireUser();
  const existing = await getFeedingPresetForUser(user.id, id);
  if (!existing) {
    return { error: "プリセットが見つかりませんでした" };
  }

  // 最初の確認の後に家から外された場合に削除が通らないよう、所属の確認は DELETE の WHERE にも含める
  const db = getDb();
  await db.batch([
    db
      .delete(feedingPresetItems)
      .where(
        and(
          eq(feedingPresetItems.presetId, id),
          isHouseholdMemberCondition(existing.householdId, user.id),
        ),
      ),
    db
      .delete(feedingPresets)
      .where(
        and(
          eq(feedingPresets.id, id),
          isHouseholdMemberCondition(feedingPresets.householdId, user.id),
        ),
      ),
  ]);
  return {};
}
