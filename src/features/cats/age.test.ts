import { describe, expect, it } from "vitest";
import { calculateAge, calculateDaysSinceAdoption, formatAge } from "./age";

describe("calculateAge", () => {
  it("誕生日を迎えている場合は満年齢を計算する", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateAge("2020-04-01", now)).toEqual({ years: 6, months: 5 });
  });

  it("誕生日を迎えていない場合は前月までで計算する", () => {
    const now = new Date("2026-03-31T00:00:00Z");
    expect(calculateAge("2020-04-01", now)).toEqual({ years: 5, months: 11 });
  });

  it("誕生日当日は年齢を1つ繰り上げる", () => {
    const now = new Date("2026-04-01T00:00:00Z");
    expect(calculateAge("2020-04-01", now)).toEqual({ years: 6, months: 0 });
  });

  it("生後1年未満は0歳として計算する", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateAge("2026-06-01", now)).toEqual({ years: 0, months: 3 });
  });
});

describe("formatAge", () => {
  it("年と月がある場合は両方表示する", () => {
    expect(formatAge({ years: 6, months: 5 })).toBe("6歳5ヶ月");
  });

  it("月が0の場合は年のみ表示する", () => {
    expect(formatAge({ years: 6, months: 0 })).toBe("6歳");
  });

  it("年が0の場合は月のみ表示する", () => {
    expect(formatAge({ years: 0, months: 3 })).toBe("3ヶ月");
  });

  it("生後0ヶ月は0ヶ月と表示する", () => {
    expect(formatAge({ years: 0, months: 0 })).toBe("0ヶ月");
  });
});

describe("calculateDaysSinceAdoption", () => {
  it("お迎え日からの経過日数を計算する", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateDaysSinceAdoption("2026-08-01", now)).toBe(36);
  });

  it("お迎え日当日は0日", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateDaysSinceAdoption("2026-09-06", now)).toBe(0);
  });

  it("年をまたいでも正しく計算する", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    expect(calculateDaysSinceAdoption("2025-12-31", now)).toBe(5);
  });
});
