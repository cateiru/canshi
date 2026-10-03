import { describe, expect, it } from "vitest";
import {
  calculateEstimatedIntakeG,
  calculateEstimatedKcal,
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

describe("sumFeedingTotals", () => {
  it("商品ごとの推定摂取量・カロリーを合計する", () => {
    expect(
      sumFeedingTotals([
        { estimatedIntakeG: 20, estimatedKcal: 60 },
        { estimatedIntakeG: 10, estimatedKcal: 40 },
      ]),
    ).toEqual({ totalIntakeG: 30, totalKcal: 100 });
  });

  it("推定値を持たない（null の）商品は 0 として扱う", () => {
    expect(
      sumFeedingTotals([{ estimatedIntakeG: null, estimatedKcal: null }]),
    ).toEqual({ totalIntakeG: 0, totalKcal: 0 });
  });
});
