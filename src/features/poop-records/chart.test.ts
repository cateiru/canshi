import { describe, expect, it } from "vitest";
import {
  filterByPeriod,
  type PoopChartPoint,
  toPoopChartPoints,
} from "./chart";

function record(
  id: string,
  occurredAtIso: string,
  consistency: "hard" | "normal" | "soft" | "liquid" = "normal",
) {
  return {
    id,
    occurredAt: new Date(occurredAtIso),
    consistency,
  };
}

describe("toPoopChartPoints", () => {
  it("日時の昇順に並べ替える", () => {
    const records = [
      record("a", "2026-09-10T08:00:00.000Z"),
      record("b", "2026-09-01T08:00:00.000Z"),
      record("c", "2026-09-05T08:00:00.000Z"),
    ];

    const points = toPoopChartPoints(records);

    expect(points.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("occurredAt の時・分から0〜24の小数の時刻を算出する", () => {
    const records = [record("a", "2026-09-01T14:30:00.000Z")];

    const points = toPoopChartPoints(records);

    expect(points[0]?.hourValue).toBe(14.5);
  });

  it("consistency と occurredAtIso をそのまま引き継ぐ", () => {
    const records = [record("a", "2026-09-01T08:00:00.000Z", "liquid")];

    const points = toPoopChartPoints(records);

    expect(points[0]).toEqual({
      id: "a",
      occurredAtIso: "2026-09-01T08:00:00.000Z",
      consistency: "liquid",
      hourValue: 8,
    });
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(toPoopChartPoints([])).toEqual([]);
  });
});

describe("filterByPeriod", () => {
  const now = new Date("2026-09-30T00:00:00.000Z");

  const points: PoopChartPoint[] = [
    {
      id: "a",
      occurredAtIso: "2025-01-01T00:00:00.000Z",
      consistency: "normal",
      hourValue: 8,
    }, // 全期間のみ
    {
      id: "b",
      occurredAtIso: "2026-07-01T00:00:00.000Z",
      consistency: "normal",
      hourValue: 8,
    }, // 3ヶ月より前
    {
      id: "c",
      occurredAtIso: "2026-08-05T00:00:00.000Z",
      consistency: "normal",
      hourValue: 8,
    }, // 3ヶ月以内・1ヶ月より前
    {
      id: "d",
      occurredAtIso: "2026-09-15T00:00:00.000Z",
      consistency: "normal",
      hourValue: 8,
    }, // 1ヶ月以内
    {
      id: "e",
      occurredAtIso: "2026-09-30T00:00:00.000Z",
      consistency: "normal",
      hourValue: 8,
    }, // ちょうど now
  ];

  it("all は全件を返す", () => {
    expect(filterByPeriod(points, "all", now)).toEqual(points);
  });

  it("3m は直近90日以内の点のみ返す", () => {
    const result = filterByPeriod(points, "3m", now);
    expect(result.map((p) => p.id)).toEqual(["c", "d", "e"]);
  });

  it("1m は直近30日以内の点のみ返す", () => {
    const result = filterByPeriod(points, "1m", now);
    expect(result.map((p) => p.id)).toEqual(["d", "e"]);
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(filterByPeriod([], "1m", now)).toEqual([]);
  });
});
