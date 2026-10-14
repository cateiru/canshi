import { describe, expect, it } from "vitest";
import { formatFoodProductTarget, formatPackageAmount } from "./labels";

describe("formatPackageAmount", () => {
  it("単位があれば 1 単位あたりの内容量として表示する", () => {
    expect(formatPackageAmount({ packageAmountG: 14, packageUnit: "本" })).toBe(
      "14g/本",
    );
  });

  it("単位がなければ商品全体の内容量として表示する", () => {
    expect(
      formatPackageAmount({ packageAmountG: 1500, packageUnit: null }),
    ).toBe("1500g");
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
