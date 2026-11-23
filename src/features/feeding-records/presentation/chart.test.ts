import { describe, expect, it } from "vitest";
import {
  availableFeedingChartMetrics,
  type FeedingChartPoint,
  feedingChartValue,
  filterByMetric,
  filterByPeriod,
  toFeedingChartPoints,
} from "./chart";

function item(
  estimatedIntakeG: number,
  estimatedKcal: number,
  amountUnit: "g" | "ml" = "g",
) {
  return {
    id: "item-1",
    foodProductId: "product-1",
    foodProductName: "テスト商品",
    amountUnit,
    givenAmountG: estimatedIntakeG,
    leftoverAmountG: 0,
    estimatedIntakeG,
    estimatedKcal,
  };
}

describe("toFeedingChartPoints", () => {
  it("日付の昇順に並べ替える", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-10T00:00:00.000Z"),
        items: [item(30, 90)],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T00:00:00.000Z"),
        items: [item(20, 60)],
      },
      {
        mode: "strict" as const,
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
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T00:00:00.000Z"),
        items: [item(20, 60), item(10, 40)],
      },
    ];

    const points = toFeedingChartPoints(records);

    expect(points[0]?.totalIntakeG).toBe(30);
    expect(points[0]?.totalKcal).toBe(100);
  });

  it("日の合計カロリーは記録ごとに丸めず、合計してから四捨五入する", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T00:00:00.000Z"),
        items: [item(3, 2.55)],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T12:00:00.000Z"),
        items: [item(3, 2.55)],
      },
    ];

    const points = toFeedingChartPoints(records);

    // 記録ごとに 2.6 に丸めてから足すと 5.2 になってしまう
    expect(points[0]?.totalKcal).toBe(5.1);
  });

  it("日の合計カロリーは小数第二位を四捨五入する", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T00:00:00.000Z"),
        items: [item(10, 1.1)],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T12:00:00.000Z"),
        items: [item(10, 2.2)],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T18:00:00.000Z"),
        items: [item(10, 0.1)],
      },
    ];

    const points = toFeedingChartPoints(records);

    // そのまま足すと 3.4000000000000004 になる
    expect(points[0]?.totalKcal).toBe(3.4);
  });

  it("同じ日付の複数記録を1点に合算する", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T08:00:00.000Z"),
        items: [item(20, 60)],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T20:00:00.000Z"),
        items: [item(10, 40)],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-02T08:00:00.000Z"),
        items: [item(15, 45)],
      },
    ];

    const points = toFeedingChartPoints(records);

    expect(points).toEqual([
      {
        occurredAtIso: "2026-09-01T00:00:00.000Z",
        totalIntakeG: 30,
        totalIntakeMl: null,
        totalKcal: 100,
      },
      {
        occurredAtIso: "2026-09-02T00:00:00.000Z",
        totalIntakeG: 15,
        totalIntakeMl: null,
        totalKcal: 45,
      },
    ]);
  });

  it("日付境界をまたぐ時刻でも日付単位で正しく分ける（23:30 と翌 00:30）", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T23:30:00.000Z"),
        items: [item(20, 60)],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-02T00:30:00.000Z"),
        items: [item(10, 40)],
      },
    ];

    const points = toFeedingChartPoints(records);

    expect(points).toEqual([
      {
        occurredAtIso: "2026-09-01T00:00:00.000Z",
        totalIntakeG: 20,
        totalIntakeMl: null,
        totalKcal: 60,
      },
      {
        occurredAtIso: "2026-09-02T00:00:00.000Z",
        totalIntakeG: 10,
        totalIntakeMl: null,
        totalKcal: 40,
      },
    ]);
  });

  it("occurredAt を日付（0時0分）の ISO 文字列に変換する", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T12:34:00.000Z"),
        items: [item(20, 60)],
      },
    ];

    const points = toFeedingChartPoints(records);

    expect(points[0]?.occurredAtIso).toBe("2026-09-01T00:00:00.000Z");
  });

  it("あいまいモードの記録はグラフに含めない", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T08:00:00.000Z"),
        items: [item(20, 60)],
      },
      {
        mode: "approximate" as const,
        occurredAt: new Date("2026-09-01T18:00:00.000Z"),
        items: [
          {
            amountUnit: "g" as const,
            estimatedIntakeG: null,
            estimatedKcal: null,
          },
        ],
      },
      {
        mode: "approximate" as const,
        occurredAt: new Date("2026-09-02T08:00:00.000Z"),
        items: [
          {
            amountUnit: "g" as const,
            estimatedIntakeG: null,
            estimatedKcal: null,
          },
        ],
      },
    ];

    expect(toFeedingChartPoints(records)).toEqual([
      {
        occurredAtIso: "2026-09-01T00:00:00.000Z",
        totalIntakeG: 20,
        totalIntakeMl: null,
        totalKcal: 60,
      },
    ]);
  });

  it("g の商品と ml の商品の量は足さずに分ける。その単位の商品がない日は null", () => {
    const records = [
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-01T08:00:00.000Z"),
        items: [item(20, 60), item(30, 15, "ml")],
      },
      {
        mode: "strict" as const,
        occurredAt: new Date("2026-09-02T08:00:00.000Z"),
        items: [item(50, 25, "ml")],
      },
    ];

    expect(toFeedingChartPoints(records)).toEqual([
      {
        occurredAtIso: "2026-09-01T00:00:00.000Z",
        totalIntakeG: 20,
        totalIntakeMl: 30,
        totalKcal: 75,
      },
      {
        occurredAtIso: "2026-09-02T00:00:00.000Z",
        totalIntakeG: null,
        totalIntakeMl: 50,
        totalKcal: 25,
      },
    ]);
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(toFeedingChartPoints([])).toEqual([]);
  });
});

describe("グラフの値の切り替え", () => {
  const points: FeedingChartPoint[] = [
    {
      occurredAtIso: "2026-09-01T00:00:00.000Z",
      totalIntakeG: 20,
      totalIntakeMl: null,
      totalKcal: 60,
    },
    {
      occurredAtIso: "2026-09-02T00:00:00.000Z",
      totalIntakeG: null,
      totalIntakeMl: 50,
      totalKcal: 25,
    },
  ];

  it("値はグラフの種類ごとに読む", () => {
    expect(feedingChartValue(points[0], "intake")).toBe(20);
    expect(feedingChartValue(points[0], "intakeMl")).toBeNull();
    expect(feedingChartValue(points[1], "kcal")).toBe(25);
  });

  it("ml の商品を記録した日があるときだけ飲んだ量を選べる", () => {
    expect(availableFeedingChartMetrics(points)).toEqual([
      "intake",
      "intakeMl",
      "kcal",
    ]);
    expect(availableFeedingChartMetrics([points[0]])).toEqual([
      "intake",
      "kcal",
    ]);
    expect(availableFeedingChartMetrics([points[1]])).toEqual([
      "intakeMl",
      "kcal",
    ]);
  });

  it("食べた量・飲んだ量は、その単位の商品を記録した日の点だけにする", () => {
    expect(filterByMetric(points, "intake")).toEqual([points[0]]);
    expect(filterByMetric(points, "intakeMl")).toEqual([points[1]]);
    expect(filterByMetric(points, "kcal")).toEqual(points);
  });
});

describe("filterByPeriod", () => {
  const now = new Date("2026-09-30T00:00:00.000Z");

  const points: FeedingChartPoint[] = [
    {
      occurredAtIso: "2025-01-01T00:00:00.000Z",
      totalIntakeG: 10,
      totalIntakeMl: null,
      totalKcal: 30,
    }, // 全期間のみ
    {
      occurredAtIso: "2026-07-01T00:00:00.000Z",
      totalIntakeG: 20,
      totalIntakeMl: null,
      totalKcal: 60,
    }, // 3ヶ月より前
    {
      occurredAtIso: "2026-08-05T00:00:00.000Z",
      totalIntakeG: 30,
      totalIntakeMl: null,
      totalKcal: 90,
    }, // 3ヶ月以内・1ヶ月より前
    {
      occurredAtIso: "2026-09-15T00:00:00.000Z",
      totalIntakeG: 40,
      totalIntakeMl: null,
      totalKcal: 120,
    }, // 1ヶ月以内
    {
      occurredAtIso: "2026-09-30T00:00:00.000Z",
      totalIntakeG: 50,
      totalIntakeMl: null,
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
