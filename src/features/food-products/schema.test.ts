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
