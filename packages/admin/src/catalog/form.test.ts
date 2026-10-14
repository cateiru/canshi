import { describe, expect, it } from "vitest";
import { parseCatalogFoodProductForm } from "./form";
import { sniffImageType } from "./image";

const VALID = {
  name: " まぐろ ",
  manufacturer: " ",
  kcalPer100g: "40.5",
  packageAmountG: "14",
  packageUnit: "1本",
  nutritionType: "general",
  textureType: "wet",
  targetBreed: "",
};

describe("parseCatalogFoodProductForm", () => {
  it("メインアプリのごはん商品と同じ規則で値を整える", () => {
    const parsed = parseCatalogFoodProductForm({
      ...VALID,
      lifeStages: ["care", "kitten"],
      image: new File([], ""),
      removeImage: "1",
    });
    expect(parsed).toEqual({
      ok: true,
      values: {
        name: "まぐろ",
        manufacturer: null,
        kcalPer100g: 40.5,
        packageAmountG: 14,
        // 先頭の「1」は取り除く
        packageUnit: "本",
        nutritionType: "general",
        textureType: "wet",
        lifeStages: ["kitten", "care"],
        targetBreed: null,
      },
      // ファイルを選ばずに送られた空のファイルは、画像なしとして扱う
      image: null,
      removeImage: true,
    });
  });

  it("対象の猫が 1 つだけでも配列として受け取る", () => {
    const parsed = parseCatalogFoodProductForm({
      ...VALID,
      lifeStages: "adult",
    });
    expect(parsed.ok && parsed.values.lifeStages).toEqual(["adult"]);
  });

  it("誤りのある項目ごとにエラーを返す", () => {
    const parsed = parseCatalogFoodProductForm({
      ...VALID,
      name: "",
      kcalPer100g: "abc",
      packageAmountG: "-1",
      nutritionType: "unknown",
      textureType: "",
      lifeStages: ["puppy"],
      packageUnit: "とても長い単位の名前です",
    });
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && Object.keys(parsed.errors).sort()).toEqual(
      [
        "kcalPer100g",
        "lifeStages",
        "name",
        "nutritionType",
        "packageAmountG",
        "packageUnit",
        "textureType",
      ].sort(),
    );
  });
});

describe("sniffImageType", () => {
  it("先頭のバイト列から JPEG・PNG・WebP を判定し、それ以外は断る", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))).toBe(
      "image/jpeg",
    );
    expect(
      sniffImageType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(
      sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")),
    ).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});
