import { describe, expect, it } from "vitest";
import {
  hasAdvancedCriteria,
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

describe("toContainsPattern", () => {
  it("LIKE のワイルドカードとエスケープ文字をエスケープする", () => {
    expect(toContainsPattern("100%_ちゅ\\る")).toBe("%100\\%\\_ちゅ\\\\る%");
  });
});
