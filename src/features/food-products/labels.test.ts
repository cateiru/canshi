import { describe, expect, it } from "vitest";
import {
  formatFoodProductTarget,
  formatPackageAmount,
  packageAmountParts,
} from "./labels";

describe("formatPackageAmount", () => {
  it("単位があれば 1 単位あたりの内容量として表示する", () => {
    expect(formatPackageAmount({ packageAmountG: 14, packageUnit: "本" })).toBe(
      "14g/本",
    );
  });

  it("単位がなければ商品全体の内容量として表示する", () => {
    expect(
      formatPackageAmount({ packageAmountG: 500, packageUnit: null }),
    ).toBe("500g");
  });

  it("1000g 以上は kg で表示する", () => {
    expect(
      formatPackageAmount({ packageAmountG: 1500, packageUnit: null }),
    ).toBe("1.5kg");
    expect(
      formatPackageAmount({ packageAmountG: 1000, packageUnit: "袋" }),
    ).toBe("1kg/袋");
  });
});

describe("packageAmountParts", () => {
  it("1000g 未満は g のまま", () => {
    expect(packageAmountParts(999.5)).toEqual({ value: "999.5", unit: "g" });
  });

  it("1000g 以上は kg にし、割り算の誤差を出さない", () => {
    expect(packageAmountParts(1000)).toEqual({ value: "1", unit: "kg" });
    expect(packageAmountParts(2270)).toEqual({ value: "2.27", unit: "kg" });
    expect(packageAmountParts(1100.1)).toEqual({
      value: "1.1001",
      unit: "kg",
    });
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
