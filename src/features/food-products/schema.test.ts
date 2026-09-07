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
