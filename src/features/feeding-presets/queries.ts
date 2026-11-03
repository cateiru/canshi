import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  type FeedingMode,
  type FeedingPreset,
  feedingPresetItems,
  feedingPresets,
  foodProducts,
  type GivenAmountLevel,
  householdMembers,
} from "@/db/schema";
import { listFoodProductImageUrls } from "@/features/food-products/queries";

export type FeedingPresetItemWithProduct = {
  id: string;
  foodProductId: string;
  foodProductName: string;
  /** 商品画像（サムネイル）の URL。未登録なら null */
  foodProductImageUrl: string | null;
  /** 与える量（グラム）。あいまいモードのプリセットでは null */
  givenAmountG: number | null;
  /** 与える量（段階）。厳格モードのプリセットでは null */
  givenAmountLevel: GivenAmountLevel | null;
};

export type FeedingPresetWithItems = {
  id: string;
  /** プリセットを管理する家。家に属するプリセットだけを返すため null にはならない */
  householdId: string;
  name: string;
  mode: FeedingMode;
  items: FeedingPresetItemWithProduct[];
};

type FeedingPresetHeader = Omit<FeedingPresetWithItems, "items">;

const presetColumns = {
  id: feedingPresets.id,
  householdId: feedingPresets.householdId,
  name: feedingPresets.name,
  mode: feedingPresets.mode,
};

/** 家に属するプリセットだけを扱うため、`householdId` が NULL の行を除いて型を絞る */
function withHousehold(
  presets: {
    id: string;
    householdId: string | null;
    name: string;
    mode: FeedingMode;
  }[],
): FeedingPresetHeader[] {
  return presets.flatMap(({ householdId, ...preset }) =>
    householdId == null ? [] : [{ ...preset, householdId }],
  );
}

async function attachItems(
  presets: FeedingPresetHeader[],
): Promise<FeedingPresetWithItems[]> {
  if (presets.length === 0) {
    return [];
  }

  const db = getDb();
  const itemRows = await db
    .select({
      id: feedingPresetItems.id,
      presetId: feedingPresetItems.presetId,
      foodProductId: feedingPresetItems.foodProductId,
      foodProductName: foodProducts.name,
      givenAmountG: feedingPresetItems.givenAmountG,
      givenAmountLevel: feedingPresetItems.givenAmountLevel,
      sortOrder: feedingPresetItems.sortOrder,
    })
    .from(feedingPresetItems)
    .innerJoin(
      foodProducts,
      eq(feedingPresetItems.foodProductId, foodProducts.id),
    )
    .where(
      inArray(
        feedingPresetItems.presetId,
        presets.map((preset) => preset.id),
      ),
    )
    .orderBy(feedingPresetItems.sortOrder);

  const imageUrls = await listFoodProductImageUrls([
    ...new Set(itemRows.map((row) => row.foodProductId)),
  ]);

  const itemsByPresetId = new Map<string, FeedingPresetItemWithProduct[]>();
  for (const row of itemRows) {
    const list = itemsByPresetId.get(row.presetId) ?? [];
    list.push({
      id: row.id,
      foodProductId: row.foodProductId,
      foodProductName: row.foodProductName,
      foodProductImageUrl: imageUrls[row.foodProductId] ?? null,
      givenAmountG: row.givenAmountG,
      givenAmountLevel: row.givenAmountLevel,
    });
    itemsByPresetId.set(row.presetId, list);
  }

  return presets.map((preset) => ({
    ...preset,
    items: itemsByPresetId.get(preset.id) ?? [],
  }));
}

/**
 * 家のごはんプリセットの一覧。新しく登録した順（ユーザーが家に所属していることは呼び出し元で確認する）
 */
export async function listFeedingPresets(
  householdId: string,
): Promise<FeedingPresetWithItems[]> {
  const db = getDb();
  const presets = await db
    .select(presetColumns)
    .from(feedingPresets)
    .where(eq(feedingPresets.householdId, householdId))
    .orderBy(desc(feedingPresets.createdAt));

  return attachItems(withHousehold(presets));
}

/** ユーザーが所属する家のごはんプリセットの一覧。新しく登録した順 */
export async function listFeedingPresetsForUser(
  userId: string,
): Promise<FeedingPresetWithItems[]> {
  const db = getDb();
  const presets = await db
    .select(presetColumns)
    .from(feedingPresets)
    .innerJoin(
      householdMembers,
      eq(feedingPresets.householdId, householdMembers.householdId),
    )
    .where(eq(householdMembers.userId, userId))
    .orderBy(desc(feedingPresets.createdAt));

  return attachItems(withHousehold(presets));
}

/** ユーザーが所属する家のごはんプリセットであれば返す。存在しない・別の家のプリセットなら null */
export async function getFeedingPresetForUser(
  userId: string,
  id: string,
): Promise<FeedingPresetWithItems | null> {
  const db = getDb();
  const [preset] = withHousehold(
    await db
      .select(presetColumns)
      .from(feedingPresets)
      .innerJoin(
        householdMembers,
        eq(feedingPresets.householdId, householdMembers.householdId),
      )
      .where(
        and(eq(feedingPresets.id, id), eq(householdMembers.userId, userId)),
      )
      .limit(1),
  );

  if (!preset) {
    return null;
  }

  const [withItems] = await attachItems([preset]);
  return withItems;
}

/**
 * 複数の家のプリセット（明細を含まない行）。新しく登録した順
 * （ユーザーが家に所属していることは呼び出し元で確認する）
 */
export async function listFeedingPresetsByHouseholdIds(
  householdIds: string[],
  d1?: D1Database,
): Promise<FeedingPreset[]> {
  const db = getDb(d1);
  const presets: FeedingPreset[] = [];
  // 家の ID は D1 のバインド上限に収まるよう分割し、まとめてから新しい順に並べる
  for (const ids of chunkForBoundParameters(householdIds)) {
    presets.push(
      ...(await db
        .select()
        .from(feedingPresets)
        .where(inArray(feedingPresets.householdId, ids))),
    );
  }
  return presets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** プリセットの明細と商品名（画像の URL は含めない） */
export type FeedingPresetItemSummary = {
  presetId: string;
  foodProductId: string;
  foodProductName: string;
  givenAmountG: number | null;
  givenAmountLevel: GivenAmountLevel | null;
};

/** 複数のプリセットの明細。プリセットごとの並び順 */
export async function listFeedingPresetItemSummaries(
  presetIds: string[],
  d1?: D1Database,
): Promise<FeedingPresetItemSummary[]> {
  const db = getDb(d1);
  const rows: FeedingPresetItemSummary[] = [];
  for (const ids of chunkForBoundParameters(presetIds)) {
    rows.push(
      ...(await db
        .select({
          presetId: feedingPresetItems.presetId,
          foodProductId: feedingPresetItems.foodProductId,
          foodProductName: foodProducts.name,
          givenAmountG: feedingPresetItems.givenAmountG,
          givenAmountLevel: feedingPresetItems.givenAmountLevel,
        })
        .from(feedingPresetItems)
        .innerJoin(
          foodProducts,
          eq(feedingPresetItems.foodProductId, foodProducts.id),
        )
        .where(inArray(feedingPresetItems.presetId, ids))
        .orderBy(asc(feedingPresetItems.sortOrder))),
    );
  }
  return rows;
}

/**
 * ユーザーが所属する家のプリセットの行（明細を含まない）。存在しない・別の家のプリセットなら null
 */
export async function getFeedingPresetRowForUser(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<FeedingPreset | null> {
  const [row] = await getDb(d1)
    .select({ preset: feedingPresets })
    .from(feedingPresets)
    .innerJoin(
      householdMembers,
      eq(feedingPresets.householdId, householdMembers.householdId),
    )
    .where(and(eq(feedingPresets.id, id), eq(householdMembers.userId, userId)))
    .limit(1);
  return row?.preset ?? null;
}
