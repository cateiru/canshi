import { describe, expect, it } from "vitest";
import { D1_MAX_BOUND_PARAMETERS } from "@/db/batch";
import {
  hasAdvancedCriteria,
  MAX_KEYWORDS,
  parseCatalogSearchParams,
  toContainsPattern,
} from "./search";

describe("parseCatalogSearchParams", () => {
  it("キーワードを空白（全角を含む）で区切り、条件を読み取る", () => {
    const criteria = parseCatalogSearchParams({
      q: " まぐろ　かつお  ",
      manufacturer: " いなば ",
      textureType: "wet",
      nutritionType: "general",
      lifeStage: "senior",
      targetBreed: "ペルシャ",
    });
    expect(criteria).toEqual({
      keywords: ["まぐろ", "かつお"],
      manufacturer: "いなば",
      textureType: "wet",
      nutritionType: "general",
      lifeStage: "senior",
      targetBreed: "ペルシャ",
    });
    expect(hasAdvancedCriteria(criteria)).toBe(true);
  });

  it("未指定・空文字・選択肢にない値・複数指定は、指定なしとして扱う", () => {
    const criteria = parseCatalogSearchParams({
      q: "   ",
      manufacturer: "",
      textureType: "frozen",
      nutritionType: ["complete", "general"],
      lifeStage: undefined,
    });
    expect(criteria).toEqual({
      keywords: [],
      manufacturer: null,
      textureType: null,
      nutritionType: null,
      lifeStage: null,
      targetBreed: null,
    });
    expect(hasAdvancedCriteria(criteria)).toBe(false);
  });
});

describe("キーワードの数", () => {
  it("同じ語は 1 回にし、D1 のバインドパラメーターの上限に収まるよう上限までに絞る", () => {
    const q = Array.from({ length: 50 }, (_, index) => `語${index}`).join(" ");
    const { keywords } = parseCatalogSearchParams({ q: `${q} 語0` });
    expect(keywords).toHaveLength(MAX_KEYWORDS);
    expect(keywords[0]).toBe("語0");
    expect(parseCatalogSearchParams({ q: "まぐろ まぐろ" }).keywords).toEqual([
      "まぐろ",
    ]);
    // キーワード（1 語 3 個）・詳しい条件（5 個）・件数の上限（1 個）を足しても上限に収まる
    expect(MAX_KEYWORDS * 3 + 5 + 1).toBeLessThanOrEqual(
      D1_MAX_BOUND_PARAMETERS,
    );
  });
});

describe("toContainsPattern", () => {
  it("LIKE のワイルドカードとエスケープ文字をエスケープする", () => {
    expect(toContainsPattern("100%_ちゅ\\る")).toBe("%100\\%\\_ちゅ\\\\る%");
  });
});
