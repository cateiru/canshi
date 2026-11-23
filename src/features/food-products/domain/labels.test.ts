import { describe, expect, it } from "vitest";
import {
  formatFoodAmount,
  formatFoodProductTarget,
  formatPackageAmount,
  kcalPer100Unit,
  packageAmountParts,
} from "./labels";

describe("formatPackageAmount", () => {
  it("単位があれば 1 単位あたりの内容量として表示する", () => {
    expect(
      formatPackageAmount({
        packageAmountG: 14,
        packageUnit: "本",
        amountUnit: "g",
      }),
    ).toBe("14g/本");
  });

  it("単位がなければ商品全体の内容量として表示する", () => {
    expect(
      formatPackageAmount({
        packageAmountG: 500,
        packageUnit: null,
        amountUnit: "g",
      }),
    ).toBe("500g");
  });

  it("1000g 以上は kg で表示する", () => {
    expect(
      formatPackageAmount({
        packageAmountG: 1500,
        packageUnit: null,
        amountUnit: "g",
      }),
    ).toBe("1.5kg");
    expect(
      formatPackageAmount({
        packageAmountG: 1000,
        packageUnit: "袋",
        amountUnit: "g",
      }),
    ).toBe("1kg/袋");
  });

  it("ml の商品は ml で表示し、1000ml 以上は L にする", () => {
    expect(
      formatPackageAmount({
        packageAmountG: 200,
        packageUnit: null,
        amountUnit: "ml",
      }),
    ).toBe("200ml");
    expect(
      formatPackageAmount({
        packageAmountG: 40,
        packageUnit: "本",
        amountUnit: "ml",
      }),
    ).toBe("40ml/本");
    expect(
      formatPackageAmount({
        packageAmountG: 1000,
        packageUnit: null,
        amountUnit: "ml",
      }),
    ).toBe("1L");
  });
});

describe("packageAmountParts", () => {
  it("1000g 未満は g のまま", () => {
    expect(packageAmountParts(999.5, "g")).toEqual({
      value: "999.5",
      unit: "g",
    });
  });

  it("1000g 以上は kg にし、割り算の誤差を出さない", () => {
    expect(packageAmountParts(1000, "g")).toEqual({ value: "1", unit: "kg" });
    expect(packageAmountParts(2270, "g")).toEqual({
      value: "2.27",
      unit: "kg",
    });
    expect(packageAmountParts(1100.1, "g")).toEqual({
      value: "1.1001",
      unit: "kg",
    });
  });

  it("ml の商品は 1000ml 未満を ml、1000ml 以上を L にする", () => {
    expect(packageAmountParts(500, "ml")).toEqual({ value: "500", unit: "ml" });
    expect(packageAmountParts(1500, "ml")).toEqual({
      value: "1.5",
      unit: "L",
    });
  });
});

describe("kcalPer100Unit", () => {
  it("商品の単位あたりのカロリーの単位を返す", () => {
    expect(kcalPer100Unit("g")).toBe("kcal/100g");
    expect(kcalPer100Unit("ml")).toBe("kcal/100ml");
  });
});

describe("formatFoodAmount", () => {
  it("量に単位を付ける。量がなければ「-」にする", () => {
    expect(formatFoodAmount(30, "g")).toBe("30 g");
    expect(formatFoodAmount(50, "ml")).toBe("50 ml");
    expect(formatFoodAmount(null, "ml")).toBe("- ml");
  });
});

describe("formatFoodProductTarget", () => {
  it("対象の猫と猫種を並べて表示する", () => {
    expect(
      formatFoodProductTarget({
        lifeStages: ["adult", "senior"],
        targetBreed: "ペルシャ",
      }),
    ).toBe("成猫・シニア ・ ペルシャ");
  });

  it("片方だけ設定されていればそれだけを表示する", () => {
    expect(
      formatFoodProductTarget({ lifeStages: ["kitten"], targetBreed: null }),
    ).toBe("キトン");
    expect(
      formatFoodProductTarget({ lifeStages: [], targetBreed: "ペルシャ" }),
    ).toBe("ペルシャ");
  });

  it("どちらも未設定なら null", () => {
    expect(
      formatFoodProductTarget({ lifeStages: [], targetBreed: null }),
    ).toBeNull();
  });
});
