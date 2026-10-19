import { describe, expect, it } from "vitest";
import {
  catalogPackageSizes,
  formatPackageSize,
  parsePackageSizeValue,
  toPackageSizeValue,
} from "./packageSizes";

describe("catalogPackageSizes", () => {
  it("候補があれば候補を、空なら元の内容量を唯一の候補として返す", () => {
    const sizes = [
      { amountG: 70, unit: null },
      { amountG: 14, unit: "本" },
    ];
    expect(
      catalogPackageSizes({
        packageSizes: sizes,
        packageAmountG: 70,
        packageUnit: null,
      }),
    ).toEqual(sizes);
    expect(
      catalogPackageSizes({
        packageSizes: [],
        packageAmountG: 40,
        packageUnit: "袋",
      }),
    ).toEqual([{ amountG: 40, unit: "袋" }]);
  });
});

describe("formatPackageSize", () => {
  it("家のごはん商品と同じ表記にする", () => {
    expect(formatPackageSize({ amountG: 1500, unit: null })).toBe("1500g");
    expect(formatPackageSize({ amountG: 14, unit: "本" })).toBe("14g/本");
  });
});

describe("parsePackageSizeValue", () => {
  it("toPackageSizeValue で作った値を読み戻す", () => {
    for (const size of [
      { amountG: 12.3, unit: "本" },
      { amountG: 500, unit: null },
    ]) {
      expect(parsePackageSizeValue(toPackageSizeValue(size))).toEqual(size);
    }
  });

  it("形の違う値は null", () => {
    for (const value of [
      null,
      "",
      "70",
      "[70]",
      '["70",null]',
      "[0,null]",
      "[-1,null]",
      "[70,1]",
      "{",
    ]) {
      expect(parsePackageSizeValue(value)).toBeNull();
    }
  });
});
