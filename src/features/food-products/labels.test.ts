import { describe, expect, it } from "vitest";
import { formatPackageAmount } from "./labels";

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
