import { describe, expect, it } from "vitest";
import {
  filterCalendarDataByYear,
  listCalendarYears,
  toHospitalVisitCalendarData,
} from "./chart";

function visit(visitedAtIso: string) {
  return { visitedAt: new Date(visitedAtIso) };
}

describe("toHospitalVisitCalendarData", () => {
  it("同じ日の通院を件数として集計する", () => {
    const visits = [
      visit("2026-09-01T02:00:00.000Z"),
      visit("2026-09-01T08:00:00.000Z"),
      visit("2026-09-05T10:00:00.000Z"),
    ];

    const data = toHospitalVisitCalendarData(visits);

    expect(data).toEqual([
      { day: "2026-09-01", value: 2 },
      { day: "2026-09-05", value: 1 },
    ]);
  });

  it("日付の昇順に並べ替える", () => {
    const visits = [
      visit("2026-09-10T08:00:00.000Z"),
      visit("2025-12-31T08:00:00.000Z"),
    ];

    const data = toHospitalVisitCalendarData(visits);

    expect(data.map((d) => d.day)).toEqual(["2025-12-31", "2026-09-10"]);
  });
});

describe("listCalendarYears", () => {
  it("データに含まれる年を新しい順に返す", () => {
    const data = [
      { day: "2024-05-01", value: 1 },
      { day: "2026-01-10", value: 1 },
      { day: "2025-08-20", value: 1 },
    ];

    expect(listCalendarYears(data)).toEqual([2026, 2025, 2024]);
  });

  it("データが空なら空配列を返す", () => {
    expect(listCalendarYears([])).toEqual([]);
  });
});

describe("filterCalendarDataByYear", () => {
  it("指定した年のデータだけを返す", () => {
    const data = [
      { day: "2025-12-31", value: 1 },
      { day: "2026-01-01", value: 2 },
      { day: "2026-09-16", value: 1 },
    ];

    expect(filterCalendarDataByYear(data, 2026)).toEqual([
      { day: "2026-01-01", value: 2 },
      { day: "2026-09-16", value: 1 },
    ]);
  });
});
