import { describe, expect, it } from "vitest";
import { evaluateWeightMeasurement } from "./weightMeasurement";

describe("evaluateWeightMeasurement", () => {
  it("設定した日数が経過していれば発火する", () => {
    const candidate = evaluateWeightMeasurement(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
      14,
      new Date("2026-08-28T10:00:00.000Z"),
    );
    expect(candidate).toEqual({
      catId: "cat-1",
      kind: "weight_measurement",
      referenceId: null,
      dedupeKey: "cat-1:weight_measurement:2026-08-28",
      dueAt: new Date("2026-09-11T00:00:00.000Z"),
      elapsedDays: 14,
    });
  });

  it("まだ経過していなければ発火しない", () => {
    const candidate = evaluateWeightMeasurement(
      "cat-1",
      new Date("2026-09-10T00:00:00.000Z"),
      "UTC",
      true,
      14,
      new Date("2026-08-28T10:00:00.000Z"),
    );
    expect(candidate).toBeNull();
  });

  it("一度も体重記録していない場合は発火しない", () => {
    const candidate = evaluateWeightMeasurement(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
      14,
      null,
    );
    expect(candidate).toBeNull();
  });

  it("無効化されている場合は発火しない", () => {
    const candidate = evaluateWeightMeasurement(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      false,
      14,
      new Date("2026-08-28T10:00:00.000Z"),
    );
    expect(candidate).toBeNull();
  });

  it("タイムゾーン境界：now が JST で日付が変わっていれば発火する", () => {
    // UTC 2026-09-10 15:30 = JST 2026-09-11 00:30
    const candidate = evaluateWeightMeasurement(
      "cat-1",
      new Date("2026-09-10T15:30:00.000Z"),
      "Asia/Tokyo",
      true,
      14,
      new Date("2026-08-28T00:00:00.000Z"),
    );
    expect(candidate).not.toBeNull();
  });
});
