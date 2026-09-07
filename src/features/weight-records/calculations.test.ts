import { describe, expect, it } from "vitest";
import { calculateCatWeightKg } from "./calculations";

describe("calculateCatWeightKg", () => {
  it("人間込みの体重から人間だけの体重を引いた値を返す", () => {
    expect(calculateCatWeightKg(65.2, 61)).toBeCloseTo(4.2);
  });
});
