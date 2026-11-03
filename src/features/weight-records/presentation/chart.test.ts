import { describe, expect, it } from "vitest";
import {
  filterByPeriod,
  toWeightChartPoints,
  type WeightChartPoint,
} from "./chart";

describe("toWeightChartPoints", () => {
  it("occurredAt 降順の入力を昇順に並べ替える", () => {
    const records = [
      { occurredAt: new Date("2026-09-10T00:00:00.000Z"), catWeightKg: 4.2 },
      { occurredAt: new Date("2026-09-01T00:00:00.000Z"), catWeightKg: 4.0 },
      { occurredAt: new Date("2026-09-05T00:00:00.000Z"), catWeightKg: 4.1 },
    ];

    const points = toWeightChartPoints(records);

    expect(points.map((p) => p.catWeightKg)).toEqual([4.0, 4.1, 4.2]);
  });

  it("occurredAt を ISO 文字列に変換する", () => {
    const records = [
      { occurredAt: new Date("2026-09-01T12:34:00.000Z"), catWeightKg: 4.0 },
    ];

    const points = toWeightChartPoints(records);

    expect(points[0]?.occurredAtIso).toBe("2026-09-01T12:34:00.000Z");
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(toWeightChartPoints([])).toEqual([]);
  });
});

describe("filterByPeriod", () => {
  const now = new Date("2026-09-30T00:00:00.000Z");

  const points: WeightChartPoint[] = [
    { occurredAtIso: "2025-01-01T00:00:00.000Z", catWeightKg: 3.5 }, // 全期間のみ
    { occurredAtIso: "2026-07-01T00:00:00.000Z", catWeightKg: 3.8 }, // 3ヶ月より前
    { occurredAtIso: "2026-08-05T00:00:00.000Z", catWeightKg: 4.0 }, // 3ヶ月以内・1ヶ月より前
    { occurredAtIso: "2026-09-15T00:00:00.000Z", catWeightKg: 4.1 }, // 1ヶ月以内
    { occurredAtIso: "2026-09-30T00:00:00.000Z", catWeightKg: 4.2 }, // ちょうど now
  ];

  it("all は全件を返す", () => {
    expect(filterByPeriod(points, "all", now)).toEqual(points);
  });

  it("3m は直近90日以内の点のみ返す", () => {
    const result = filterByPeriod(points, "3m", now);
    expect(result.map((p) => p.catWeightKg)).toEqual([4.0, 4.1, 4.2]);
  });

  it("1m は直近30日以内の点のみ返す", () => {
    const result = filterByPeriod(points, "1m", now);
    expect(result.map((p) => p.catWeightKg)).toEqual([4.1, 4.2]);
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(filterByPeriod([], "1m", now)).toEqual([]);
  });
});
