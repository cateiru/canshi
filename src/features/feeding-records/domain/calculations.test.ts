import { describe, expect, it } from "vitest";
import {
  calculateEstimatedIntakeG,
  calculateEstimatedKcal,
  roundKcal,
  sumFeedingTotals,
} from "./calculations";

describe("calculateEstimatedIntakeG", () => {
  it("与えた量から残した量を引いた値を返す", () => {
    expect(calculateEstimatedIntakeG(30, 5)).toBe(25);
  });

  it("残さず食べた場合は与えた量がそのまま返る", () => {
    expect(calculateEstimatedIntakeG(30, 0)).toBe(30);
  });
});

describe("calculateEstimatedKcal", () => {
  it("推定摂取量とカロリーから推定摂取カロリーを計算する", () => {
    expect(calculateEstimatedKcal(25, 380)).toBeCloseTo(95);
  });

  it("摂取量が0の場合は0kcalになる", () => {
    expect(calculateEstimatedKcal(0, 380)).toBe(0);
  });
});

describe("roundKcal", () => {
  it("小数第二位を四捨五入して小数第一位までにする", () => {
    expect(roundKcal(12.34)).toBe(12.3);
    expect(roundKcal(12.35)).toBe(12.4);
    expect(roundKcal(12.96)).toBe(13);
  });

  it("二進数で表せない .x5 も切り上げる", () => {
    // toFixed(1) ではそれぞれ "2.5"・"1.1"・"19.5" になる
    expect(roundKcal(2.55)).toBe(2.6);
    expect(roundKcal(1.15)).toBe(1.2);
    expect(roundKcal(19.55)).toBe(19.6);
  });

  it("計算で乗った浮動小数の誤差を吸収する", () => {
    expect(roundKcal(0.1 + 0.2)).toBe(0.3);
    expect(roundKcal(calculateEstimatedKcal(3, 85))).toBe(2.6);
    // 1.13 + 1.22 は 2.3499999999999996 になる
    expect(roundKcal(1.13 + 1.22)).toBe(2.4);
  });

  it("整数や 0 はそのまま返す", () => {
    expect(roundKcal(95)).toBe(95);
    expect(roundKcal(0)).toBe(0);
  });
});

describe("sumFeedingTotals", () => {
  it("商品ごとの推定摂取量・カロリーを合計する", () => {
    expect(
      sumFeedingTotals([
        { estimatedIntakeG: 20, estimatedKcal: 60 },
        { estimatedIntakeG: 10, estimatedKcal: 40 },
      ]),
    ).toEqual({ totalIntakeG: 30, totalKcal: 100 });
  });

  it("カロリーの合計は小数第二位を四捨五入する", () => {
    expect(
      sumFeedingTotals([
        { estimatedIntakeG: 3, estimatedKcal: calculateEstimatedKcal(3, 85) },
        { estimatedIntakeG: 7, estimatedKcal: calculateEstimatedKcal(7, 33) },
      ]).totalKcal,
    ).toBe(4.9);
  });

  it("推定値を持たない（null の）商品は 0 として扱う", () => {
    expect(
      sumFeedingTotals([{ estimatedIntakeG: null, estimatedKcal: null }]),
    ).toEqual({ totalIntakeG: 0, totalKcal: 0 });
  });
});
