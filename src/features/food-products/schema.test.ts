import { describe, expect, it } from "vitest";
import { foodProductFormSchema } from "./schema";

describe("foodProductFormSchema", () => {
  it("すべての項目を入力すると成功する", () => {
    const result = foodProductFormSchema.safeParse({
      name: "モンプチ",
      kcalPer100g: "380",
      packageAmountG: "1500",
      nutritionType: "complete",
      textureType: "dry",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kcalPer100g).toBe(380);
      expect(result.data.packageAmountG).toBe(1500);
    }
  });

  it("商品名が空の場合は失敗する", () => {
    const result = foodProductFormSchema.safeParse({
      name: "",
      kcalPer100g: "380",
      packageAmountG: "1500",
      nutritionType: "complete",
      textureType: "dry",
    });

    expect(result.success).toBe(false);
  });

  it("カロリーが0以下の場合は失敗する", () => {
    const result = foodProductFormSchema.safeParse({
      name: "モンプチ",
      kcalPer100g: "0",
      packageAmountG: "1500",
      nutritionType: "complete",
      textureType: "dry",
    });

    expect(result.success).toBe(false);
  });

  it("カロリーが未入力（空文字）の場合は必須エラーになる", () => {
    const result = foodProductFormSchema.safeParse({
      name: "モンプチ",
      kcalPer100g: "",
      packageAmountG: "1500",
      nutritionType: "complete",
      textureType: "dry",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.kcalPer100g?.[0]).toBe(
        "カロリー（kcal/100g）を入力してください",
      );
    }
  });

  it("内容量が0以下の場合は失敗する", () => {
    const result = foodProductFormSchema.safeParse({
      name: "モンプチ",
      kcalPer100g: "380",
      packageAmountG: "0",
      nutritionType: "complete",
      textureType: "dry",
    });

    expect(result.success).toBe(false);
  });

  it("単位が未入力（空文字・未送信）の場合は null になる", () => {
    for (const packageUnit of ["", "  ", null, undefined]) {
      const result = foodProductFormSchema.safeParse({
        name: "モンプチ",
        kcalPer100g: "380",
        packageAmountG: "1500",
        packageUnit,
        nutritionType: "complete",
        textureType: "dry",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.packageUnit).toBeNull();
      }
    }
  });

  it("単位は前後の空白を取り除いて保持する", () => {
    const result = foodProductFormSchema.safeParse({
      name: "ちゃおちゅーる",
      kcalPer100g: "40",
      packageAmountG: "14",
      packageUnit: " 本 ",
      nutritionType: "general",
      textureType: "wet",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.packageUnit).toBe("本");
    }
  });

  it("単位に「1本」のように数量ごと入力されても先頭の 1 を取り除く", () => {
    for (const [input, expected] of [
      ["1本", "本"],
      ["１袋", "袋"],
      ["1 パック", "パック"],
    ]) {
      const result = foodProductFormSchema.safeParse({
        name: "ちゃおちゅーる",
        kcalPer100g: "40",
        packageAmountG: "14",
        packageUnit: input,
        nutritionType: "general",
        textureType: "wet",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.packageUnit).toBe(expected);
      }
    }
  });

  it("単位が10文字を超える場合は失敗する", () => {
    const result = foodProductFormSchema.safeParse({
      name: "ちゃおちゅーる",
      kcalPer100g: "40",
      packageAmountG: "14",
      packageUnit: "あ".repeat(11),
      nutritionType: "general",
      textureType: "wet",
    });

    expect(result.success).toBe(false);
  });

  it("区分が不正な値の場合は失敗する", () => {
    const result = foodProductFormSchema.safeParse({
      name: "モンプチ",
      kcalPer100g: "380",
      packageAmountG: "1500",
      nutritionType: "invalid",
      textureType: "dry",
    });

    expect(result.success).toBe(false);
  });
});
