import { describe, expect, it } from "vitest";
import { CAT_BREEDS, matchesBreed, normalizeBreedText } from "./breeds";

describe("normalizeBreedText", () => {
  it("ひらがなをカタカナにそろえる", () => {
    expect(normalizeBreedText("まんちかん")).toBe(
      normalizeBreedText("マンチカン"),
    );
  });

  it("全角英字・大文字小文字・空白・中点・長音記号を吸収する", () => {
    expect(normalizeBreedText("Ｍａｉｎｅ Coon")).toBe("mainecoon");
    expect(normalizeBreedText("スコティッシュフォールド・ロングヘアー")).toBe(
      normalizeBreedText("スコティッシュフォールドロングヘア"),
    );
  });
});

describe("matchesBreed", () => {
  it("入力が空なら常に候補に出す", () => {
    expect(matchesBreed("マンチカン", "")).toBe(true);
    expect(matchesBreed("マンチカン", "  ")).toBe(true);
  });

  it("ひらがなの途中入力でカタカナの猫種に一致する", () => {
    expect(matchesBreed("マンチカン", "まんち")).toBe(true);
    expect(matchesBreed("マンチカン", "らぐ")).toBe(false);
  });

  it("英語名でも一致する", () => {
    expect(
      matchesBreed("ノルウェージャンフォレストキャット", "norwegian"),
    ).toBe(true);
  });

  it("通称でも一致する", () => {
    expect(matchesBreed("アメリカンショートヘア", "あめしょ")).toBe(true);
    expect(matchesBreed("ミックス（雑種）", "ざっしゅ")).toBe(true);
  });

  it("候補にない名前も部分一致で判定できる", () => {
    expect(matchesBreed("三毛猫", "三毛")).toBe(true);
  });
});

describe("CAT_BREEDS", () => {
  it("名前が重複せず、保存できる50文字以内に収まる", () => {
    const names = CAT_BREEDS.map((breed) => breed.name);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(50);
    }
  });
});
