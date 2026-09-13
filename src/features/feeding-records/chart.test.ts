import { describe, expect, it } from "vitest";
import {
  type FeedingChartPoint,
  filterByPeriod,
  toFeedingChartPoints,
} from "./chart";

function item(estimatedIntakeG: number, estimatedKcal: number) {
  return {
    id: "item-1",
    foodProductId: "product-1",
    foodProductName: "テスト商品",
    givenAmountG: estimatedIntakeG,
    leftoverAmountG: 0,
    estimatedIntakeG,
    estimatedKcal,
  };
}

describe("toFeedingChartPoints", () => {
  it("occurredAt 降順の入力を昇順に並べ替える", () => {
    const records = [
      {
        occurredAt: new Date("2026-09-10T00:00:00.000Z"),
        items: [item(30, 90)],
      },
      {
        occurredAt: new Date("2026-09-01T00:00:00.000Z"),
        items: [item(20, 60)],
      },
      {
        occurredAt: new Date("2026-09-05T00:00:00.000Z"),
        items: [item(25, 75)],
      },
    ];

    const points = toFeedingChartPoints(records);

    expect(points.map((p) => p.totalIntakeG)).toEqual([20, 25, 30]);
  });

  it("同一記録内の複数商品の量・カロリーを合算する", () => {
    const records = [
      {
        occurredAt: new Date("2026-09-01T00:00:00.000Z"),
        items: [item(20, 60), item(10, 40)],
      },
    ];

    const points = toFeedingChartPoints(records);

    expect(points[0]?.totalIntakeG).toBe(30);
    expect(points[0]?.totalKcal).toBe(100);
  });

  it("occurredAt を ISO 文字列に変換する", () => {
    const records = [
      {
        occurredAt: new Date("2026-09-01T12:34:00.000Z"),
        items: [item(20, 60)],
      },
    ];

    const points = toFeedingChartPoints(records);

    expect(points[0]?.occurredAtIso).toBe("2026-09-01T12:34:00.000Z");
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(toFeedingChartPoints([])).toEqual([]);
  });
});

describe("filterByPeriod", () => {
  const now = new Date("2026-09-30T00:00:00.000Z");

  const points: FeedingChartPoint[] = [
    {
      occurredAtIso: "2025-01-01T00:00:00.000Z",
      totalIntakeG: 10,
      totalKcal: 30,
    }, // 全期間のみ
    {
      occurredAtIso: "2026-07-01T00:00:00.000Z",
      totalIntakeG: 20,
      totalKcal: 60,
    }, // 3ヶ月より前
    {
      occurredAtIso: "2026-08-05T00:00:00.000Z",
      totalIntakeG: 30,
      totalKcal: 90,
    }, // 3ヶ月以内・1ヶ月より前
    {
      occurredAtIso: "2026-09-15T00:00:00.000Z",
      totalIntakeG: 40,
      totalKcal: 120,
    }, // 1ヶ月以内
    {
      occurredAtIso: "2026-09-30T00:00:00.000Z",
      totalIntakeG: 50,
      totalKcal: 150,
    }, // ちょうど now
  ];

  it("all は全件を返す", () => {
    expect(filterByPeriod(points, "all", now)).toEqual(points);
  });

  it("3m は直近90日以内の点のみ返す", () => {
    const result = filterByPeriod(points, "3m", now);
    expect(result.map((p) => p.totalIntakeG)).toEqual([30, 40, 50]);
  });

  it("1m は直近30日以内の点のみ返す", () => {
    const result = filterByPeriod(points, "1m", now);
    expect(result.map((p) => p.totalIntakeG)).toEqual([40, 50]);
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(filterByPeriod([], "1m", now)).toEqual([]);
  });
});
