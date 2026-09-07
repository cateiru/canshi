import { describe, expect, it } from "vitest";
import {
  calculateEstimatedIntakeG,
  calculateEstimatedKcal,
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
