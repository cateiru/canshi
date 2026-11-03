import { describe, expect, it } from "vitest";
import { estimatedIntakeMl, waterAmount } from "./waterAmount";

describe("WaterAmount", () => {
  it("推定飲水量は給水量から残量を引いた値", () => {
    expect(estimatedIntakeMl(waterAmount(200, 50))).toBe(150);
  });

  it("残量が未入力なら推定飲水量を求めない", () => {
    const amount = waterAmount(200, undefined);
    expect(amount.remainingMl).toBeNull();
    expect(estimatedIntakeMl(amount)).toBeNull();
  });
});
