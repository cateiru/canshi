import { describe, expect, it } from "vitest";
import {
  catalogPackageSizes,
  formatPackageSize,
  parsePackageSizeValue,
  toPackageSizeValue,
} from "./packageSizes";

describe("catalogPackageSizes", () => {
  it("先頭の候補は元の内容量の列から取り、2 件目以降を候補の列から取る", () => {
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

  it("古い管理画面が元の内容量の列だけを更新していたら、その値を先頭の候補にする", () => {
    expect(
      catalogPackageSizes({
        packageSizes: [{ amountG: 40, unit: "袋" }],
        packageAmountG: 50,
        packageUnit: null,
      }),
    ).toEqual([{ amountG: 50, unit: null }]);
    // 2 件目以降に先頭と同じ内容量があっても、重ねて並べない
    expect(
      catalogPackageSizes({
        packageSizes: [
          { amountG: 40, unit: "袋" },
          { amountG: 50, unit: null },
          { amountG: 160, unit: null },
        ],
        packageAmountG: 50,
        packageUnit: null,
      }),
    ).toEqual([
      { amountG: 50, unit: null },
      { amountG: 160, unit: null },
    ]);
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
