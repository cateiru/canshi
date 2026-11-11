import { describe, expect, it } from "vitest";
import {
  buildPoopChartWindow,
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

function point(id: string, occurredAtIso: string): PoopChartPoint {
  return { id, occurredAtIso, consistency: "normal", hourValue: 8 };
}

describe("buildPoopChartWindow", () => {
  // 2026-09-30 は水曜日
  const now = new Date("2026-09-30T15:00:00.000Z");

  it("1週間は今日を右端にした 7 日を 1 日 1 列に並べる", () => {
    const window = buildPoopChartWindow([], "1w", now);

    expect(window.dayStartIsos).toHaveLength(7);
    expect(window.dayStartIsos[0]).toBe("2026-09-24T00:00:00.000Z");
    expect(window.dayStartIsos[6]).toBe("2026-09-30T00:00:00.000Z");
  });

  it("1週間は毎日の境界に縦線を引き、各列の中心に目盛りを置く", () => {
    const window = buildPoopChartWindow([], "1w", now);

    expect(window.gridIndexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(window.tickIndexes).toEqual([0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5]);
  });

  it("期間内の点だけを、入る日の列に割り当てる", () => {
    const points = [
      point("before", "2026-09-23T23:59:00.000Z"),
      point("first", "2026-09-24T00:00:00.000Z"),
      point("middle", "2026-09-27T12:00:00.000Z"),
      point("today", "2026-09-30T23:00:00.000Z"),
      point("tomorrow", "2026-10-01T00:00:00.000Z"),
    ];

    const window = buildPoopChartWindow(points, "1w", now);

    expect(window.points.map(({ id, dayIndex }) => ({ id, dayIndex }))).toEqual(
      [
        { id: "first", dayIndex: 0 },
        { id: "middle", dayIndex: 3 },
        { id: "today", dayIndex: 6 },
      ],
    );
  });

  it("3ヶ月は 90 列で、縦線は両端と月曜の境界だけに引く", () => {
    const window = buildPoopChartWindow([], "3m", now);

    expect(window.dayStartIsos).toHaveLength(90);
    expect(window.dayStartIsos[0]).toBe("2026-07-03T00:00:00.000Z");
    expect(window.gridIndexes[0]).toBe(0);
    expect(window.gridIndexes.at(-1)).toBe(90);
    for (const index of window.gridIndexes.slice(1, -1)) {
      expect(new Date(window.dayStartIsos[index] ?? "").getUTCDay()).toBe(1);
    }
  });

  it("3ヶ月の目盛りは最新の月曜から 2 週ごとに置く", () => {
    const window = buildPoopChartWindow([], "3m", now);

    expect(
      window.tickIndexes.map((index) => window.dayStartIsos[index]),
    ).toEqual([
      "2026-07-06T00:00:00.000Z",
      "2026-07-20T00:00:00.000Z",
      "2026-08-03T00:00:00.000Z",
      "2026-08-17T00:00:00.000Z",
      "2026-08-31T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
      "2026-09-28T00:00:00.000Z",
    ]);
  });

  it("半年は 180 列で、目盛りを各月の 1 日に置く", () => {
    const window = buildPoopChartWindow([], "6m", now);

    expect(window.dayStartIsos).toHaveLength(180);
    expect(window.dayStartIsos[0]).toBe("2026-04-04T00:00:00.000Z");
    expect(
      window.tickIndexes.map((index) => window.dayStartIsos[index]),
    ).toEqual([
      "2026-05-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    ]);
  });
});
