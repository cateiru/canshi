import { describe, expect, it } from "vitest";
import {
  filterCalendarDataToRange,
  getLastYearRange,
  toCleaningRecordCalendarData,
} from "./recordChart";

function record(performedAtIso: string) {
  return { performedAt: new Date(performedAtIso) };
}

describe("toCleaningRecordCalendarData", () => {
  it("同じ日の実施記録を件数として集計する", () => {
    const records = [
      record("2026-09-01T02:00:00.000Z"),
      record("2026-09-01T08:00:00.000Z"),
      record("2026-09-05T10:00:00.000Z"),
    ];

    const data = toCleaningRecordCalendarData(records);

    expect(data).toEqual([
      { day: "2026-09-01", value: 2 },
      { day: "2026-09-05", value: 1 },
    ]);
  });

  it("日付の昇順に並べ替える", () => {
    const records = [
      record("2026-09-10T08:00:00.000Z"),
      record("2025-12-31T08:00:00.000Z"),
    ];

    const data = toCleaningRecordCalendarData(records);

    expect(data.map((d) => d.day)).toEqual(["2025-12-31", "2026-09-10"]);
  });
});

describe("getLastYearRange", () => {
  it("今日を終端とする直近1年分の範囲を返す", () => {
    const now = new Date("2026-09-16T00:00:00.000Z");

    expect(getLastYearRange(now)).toEqual({
      from: "2025-09-17",
      to: "2026-09-16",
    });
  });

  it("うるう年をまたぐ場合も1年分の範囲を返す", () => {
    const now = new Date("2024-03-01T00:00:00.000Z");

    expect(getLastYearRange(now)).toEqual({
      from: "2023-03-02",
      to: "2024-03-01",
    });
  });
});

describe("filterCalendarDataToRange", () => {
  it("指定した範囲内のデータだけを返す", () => {
    const data = [
      { day: "2025-09-16", value: 1 },
      { day: "2025-09-17", value: 2 },
      { day: "2026-09-16", value: 3 },
      { day: "2026-09-17", value: 1 },
    ];

    expect(
      filterCalendarDataToRange(data, {
        from: "2025-09-17",
        to: "2026-09-16",
      }),
    ).toEqual([
      { day: "2025-09-17", value: 2 },
      { day: "2026-09-16", value: 3 },
    ]);
  });
});
