import { describe, expect, it } from "vitest";
import { calculateEstimatedIntakeMl } from "./calculations";

describe("calculateEstimatedIntakeMl", () => {
  it("給水量から残量を引いた値を返す", () => {
    expect(calculateEstimatedIntakeMl(200, 50)).toBeCloseTo(150);
  });

  it("残量が未入力の場合は計算しない", () => {
    expect(calculateEstimatedIntakeMl(200, undefined)).toBeNull();
  });

  it("こぼれがあった場合も計算自体は行う（参考値の表示は呼び出し側の責務）", () => {
    expect(calculateEstimatedIntakeMl(200, 0)).toBeCloseTo(200);
  });
});
