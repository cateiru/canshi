import type {
  CatalogFoodProductJson,
  CatalogFoodProductsResponse,
  UserJson,
} from "../../api/types";

export function product(
  values: Partial<CatalogFoodProductJson> & { id: string; name: string },
): CatalogFoodProductJson {
  return {
    manufacturer: null,
    kcalPer100g: 380,
    packageSizes: [{ amountG: 500, unit: null }],
    nutritionType: "complete",
    textureType: "dry",
    lifeStages: [],
    targetBreed: null,
    searchKeywords: [],
    imageAssetId: null,
    addedCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...values,
  };
}

/** 一覧の API と同じく、メーカー名・商品名の順（メーカー名のない商品は最後） */
export const PRODUCTS: CatalogFoodProductsResponse = {
  products: [
    product({ id: "p-3", name: "とりささみ", manufacturer: "いぬフード" }),
    product({
      id: "p-2",
      name: "かつお味 パウチ",
      manufacturer: "ねこフード",
      searchKeywords: ["Premium"],
    }),
    product({
      id: "p-1",
      name: "まぐろ味 カリカリ",
      manufacturer: "ねこフード",
      packageSizes: [
        { amountG: 12.3, unit: "本" },
        { amountG: 1500, unit: null },
      ],
      lifeStages: ["adult", "senior"],
    }),
    product({ id: "p-4", name: "まぐろスープ" }),
  ],
};

export function user(
  values: Partial<UserJson> & { id: string; name: string },
): UserJson {
  return {
    role: "member",
    createdAt: "2026-10-01T00:00:00.000Z",
    activeSessionCount: 0,
    latestSessionExpiresAt: null,
    households: [],
    ...values,
  };
}
