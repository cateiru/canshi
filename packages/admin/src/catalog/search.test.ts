import { describe, expect, it } from "vitest";
import type { CatalogFoodProduct } from "../db/catalogFoodProducts";
import {
  groupCatalogFoodProducts,
  matchesCatalogKeywords,
  parseCatalogListSearch,
} from "./search";

function product(
  values: Pick<CatalogFoodProduct, "id" | "name" | "manufacturer"> &
    Partial<CatalogFoodProduct>,
): CatalogFoodProduct {
  return {
    kcalPer100g: 380,
    packageSizes: [{ amountG: 500, unit: null }],
    nutritionType: "complete",
    textureType: "dry",
    lifeStages: [],
    targetBreed: null,
    searchKeywords: [],
    imageAssetId: null,
    addedCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...values,
  };
}

describe("parseCatalogListSearch", () => {
  it("検索語を空白で分け、重なった語を除く", () => {
    expect(
      parseCatalogListSearch("ねこフード", "  まぐろ　カリカリ まぐろ "),
    ).toEqual({
      manufacturer: "ねこフード",
      keywords: ["まぐろ", "カリカリ"],
      query: "まぐろ　カリカリ まぐろ",
    });
  });

  it("空のメーカー名はメーカー名のないグループを指す", () => {
    expect(parseCatalogListSearch("", "まぐろ")).toMatchObject({
      manufacturer: null,
    });
  });

  it("メーカーか検索語が無いときは検索しない", () => {
    expect(parseCatalogListSearch(undefined, "まぐろ")).toBeNull();
    expect(parseCatalogListSearch("ねこフード", undefined)).toBeNull();
    expect(parseCatalogListSearch("ねこフード", "  ")).toBeNull();
  });

  it("上限より後ろの語は使わない", () => {
    const words = Array.from({ length: 12 }, (_, index) => `w${index}`);
    expect(
      parseCatalogListSearch("ねこフード", words.join(" "))?.keywords,
    ).toEqual(words.slice(0, 10));
  });
});

describe("matchesCatalogKeywords", () => {
  const item = product({
    id: "1",
    name: "Premium まぐろ味",
    manufacturer: "ねこフード",
    searchKeywords: ["ちゅーる"],
  });

  it("商品名か検索キーワードに、すべての語が含まれる商品に絞る", () => {
    expect(matchesCatalogKeywords(item, ["まぐろ"])).toBe(true);
    expect(matchesCatalogKeywords(item, ["ちゅーる", "まぐろ"])).toBe(true);
    expect(matchesCatalogKeywords(item, ["まぐろ", "かつお"])).toBe(false);
  });

  it("メーカー名では絞らない", () => {
    expect(matchesCatalogKeywords(item, ["ねこフード"])).toBe(false);
  });

  it("英字の大文字・小文字を区別しない", () => {
    expect(matchesCatalogKeywords(item, ["premium"])).toBe(true);
  });
});

describe("groupCatalogFoodProducts", () => {
  it("受け取った順のまま、メーカーごとにまとめる", () => {
    const groups = groupCatalogFoodProducts([
      product({ id: "1", name: "A", manufacturer: "いぬフード" }),
      product({ id: "2", name: "B", manufacturer: "ねこフード" }),
      product({ id: "3", name: "C", manufacturer: "ねこフード" }),
      product({ id: "4", name: "D", manufacturer: null }),
    ]);
    expect(
      groups.map((group) => ({
        manufacturer: group.manufacturer,
        ids: group.products.map((item) => item.id),
      })),
    ).toEqual([
      { manufacturer: "いぬフード", ids: ["1"] },
      { manufacturer: "ねこフード", ids: ["2", "3"] },
      { manufacturer: null, ids: ["4"] },
    ]);
  });
});
