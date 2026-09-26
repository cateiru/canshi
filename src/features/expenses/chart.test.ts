import { describe, expect, it } from "vitest";
import {
  buildMonthlyExpenseChart,
  formatChartYearMonth,
  getExpenseChartRange,
  sliceByPeriod,
} from "./chart";

const ZERO = {
  food: 0,
  treat: 0,
  hygiene: 0,
  toy: 0,
  medicine: 0,
  hospital: 0,
  other: 0,
};

describe("getExpenseChartRange", () => {
  it("終端の月を含めた指定か月分の範囲を返す", () => {
    expect(getExpenseChartRange({ year: 2026, month: 9 }, 6)).toEqual({
      from: { year: 2026, month: 4 },
      to: { year: 2026, month: 9 },
    });
  });

  it("年をまたぐ範囲を返す", () => {
    expect(getExpenseChartRange({ year: 2026, month: 3 })).toEqual({
      from: { year: 2025, month: 4 },
      to: { year: 2026, month: 3 },
    });
  });
});

describe("buildMonthlyExpenseChart", () => {
  it("月・カテゴリごとに合計し、古い順に並べる", () => {
    const months = buildMonthlyExpenseChart(
      [
        {
          spentAt: new Date("2026-09-10T00:00:00.000Z"),
          category: "food",
          amountYen: 1280,
        },
        {
          spentAt: new Date("2026-09-30T00:00:00.000Z"),
          category: "food",
          amountYen: 720,
        },
        {
          spentAt: new Date("2026-08-01T00:00:00.000Z"),
          category: "hospital",
          amountYen: 5500,
        },
      ],
      { year: 2026, month: 9 },
      2,
    );

    expect(months).toEqual([
      {
        ym: "2026-08",
        year: 2026,
        month: 8,
        amounts: { ...ZERO, hospital: 5500 },
        total: 5500,
      },
      {
        ym: "2026-09",
        year: 2026,
        month: 9,
        amounts: { ...ZERO, food: 2000 },
        total: 2000,
      },
    ]);
  });

  it("支出のない月も 0 で埋め、年をまたいで並べる", () => {
    const months = buildMonthlyExpenseChart(
      [
        {
          spentAt: new Date("2026-01-15T00:00:00.000Z"),
          category: "toy",
          amountYen: 800,
        },
      ],
      { year: 2026, month: 1 },
      3,
    );

    expect(months.map((month) => month.ym)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
    expect(months[0]).toMatchObject({ amounts: ZERO, total: 0 });
    expect(months[2]).toMatchObject({
      amounts: { ...ZERO, toy: 800 },
      total: 800,
    });
  });

  it("範囲外の支出は含めない", () => {
    const months = buildMonthlyExpenseChart(
      [
        {
          spentAt: new Date("2026-06-30T23:59:59.000Z"),
          category: "food",
          amountYen: 100,
        },
        {
          spentAt: new Date("2026-10-01T00:00:00.000Z"),
          category: "food",
          amountYen: 200,
        },
      ],
      { year: 2026, month: 9 },
      3,
    );

    expect(months.map((month) => month.total)).toEqual([0, 0, 0]);
  });

  it("支出がなければすべての月を 0 で返す", () => {
    const months = buildMonthlyExpenseChart([], { year: 2026, month: 9 });

    expect(months).toHaveLength(12);
    expect(months.every((month) => month.total === 0)).toBe(true);
  });
});

describe("sliceByPeriod", () => {
  it("終端の月から数えた直近の月だけを返す", () => {
    const months = buildMonthlyExpenseChart([], { year: 2026, month: 9 });

    expect(sliceByPeriod(months, "6m").map((month) => month.ym)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(sliceByPeriod(months, "12m")).toHaveLength(12);
  });

  it("「今年」は終端の月と同じ年の1月から終端の月までを返す", () => {
    const months = buildMonthlyExpenseChart([], { year: 2026, month: 3 });

    expect(sliceByPeriod(months, "year").map((month) => month.ym)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("終端が12月なら「今年」は1年分と同じになる", () => {
    const months = buildMonthlyExpenseChart([], { year: 2025, month: 12 });

    expect(sliceByPeriod(months, "year")).toEqual(sliceByPeriod(months, "12m"));
  });
});

describe("formatChartYearMonth", () => {
  it("年月を「YYYY年M月」の形式で返す", () => {
    expect(formatChartYearMonth({ year: 2026, month: 9 })).toBe("2026年9月");
  });
});
