import { describe, expect, it } from "vitest";
import { catWeightKg, catWeightMeasurementFrom } from "./catWeight";

describe("CatWeightMeasurement", () => {
  it("抱いて量ったときは、合計から人の体重を引く", () => {
    const measurement = catWeightMeasurementFrom({
      inputMethod: "auto",
      combinedWeightKg: 65.5,
      humanWeightKg: 61,
    });
    expect(catWeightKg(measurement)).toBeCloseTo(4.5);
  });

  it("直接量ったときは、その値を使う", () => {
    const measurement = catWeightMeasurementFrom({
      inputMethod: "direct",
      catWeightKg: 4.2,
      // 直接量ったときは、合計・人の体重が送られても使わない
      combinedWeightKg: 70,
      humanWeightKg: 60,
    });
    expect(catWeightKg(measurement)).toBe(4.2);
  });
});
