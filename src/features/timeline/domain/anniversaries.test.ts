import { describe, expect, it } from "vitest";
import {
  formatAdoptionRecord,
  formatBirthdayRecord,
  listAnniversariesForMonth,
} from "./anniversaries";

describe("listAnniversariesForMonth", () => {
  it("生年月日・お迎え日がなければ何も返さない", () => {
    expect(
      listAnniversariesForMonth({ birthDate: null, adoptedAt: null }, 2026, 5),
    ).toEqual({ birthdays: [], adoptions: [] });
  });

  it("1歳以上は毎年の誕生日だけを返す", () => {
    const { birthdays } = listAnniversariesForMonth(
      { birthDate: "2020-05-10", adoptedAt: null },
      2026,
      5,
    );
    expect(birthdays).toEqual([{ date: "2026-05-10", ageMonths: 72 }]);

    // 1歳以上の誕生日以外の月には何も出さない
    expect(
      listAnniversariesForMonth(
        { birthDate: "2020-05-10", adoptedAt: null },
        2026,
        6,
      ).birthdays,
    ).toEqual([]);
  });

  it("生まれた日そのものを返す", () => {
    const { birthdays } = listAnniversariesForMonth(
      { birthDate: "2026-05-10", adoptedAt: null },
      2026,
      5,
    );
    expect(birthdays).toEqual([{ date: "2026-05-10", ageMonths: 0 }]);
  });

  it("1歳未満は毎月の生まれた日と同じ日を返し、1歳の誕生日で毎年に切り替わる", () => {
    const birthDate = "2025-06-15";
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2025, 9)
        .birthdays,
    ).toEqual([{ date: "2025-09-15", ageMonths: 3 }]);
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2026, 5)
        .birthdays,
    ).toEqual([{ date: "2026-05-15", ageMonths: 11 }]);
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2026, 6)
        .birthdays,
    ).toEqual([{ date: "2026-06-15", ageMonths: 12 }]);
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2026, 7)
        .birthdays,
    ).toEqual([]);
  });

  it("生まれる前の月には何も返さない", () => {
    expect(
      listAnniversariesForMonth(
        { birthDate: "2026-05-10", adoptedAt: "2026-07-01" },
        2026,
        4,
      ),
    ).toEqual({ birthdays: [], adoptions: [] });
  });

  it("生まれた日がない月は月末の日を記念日にする", () => {
    const birthDate = "2026-01-31";
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2026, 2)
        .birthdays,
    ).toEqual([{ date: "2026-02-28", ageMonths: 1 }]);
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2026, 4)
        .birthdays,
    ).toEqual([{ date: "2026-04-30", ageMonths: 3 }]);
  });

  it("2/29 生まれは、うるう年でない年は 2/28 を誕生日にする", () => {
    const birthDate = "2024-02-29";
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2025, 2)
        .birthdays,
    ).toEqual([{ date: "2025-02-28", ageMonths: 12 }]);
    expect(
      listAnniversariesForMonth({ birthDate, adoptedAt: null }, 2028, 2)
        .birthdays,
    ).toEqual([{ date: "2028-02-29", ageMonths: 48 }]);
  });

  it("お迎え記念日はお迎えした日と毎年の同じ日を返し、毎月は返さない", () => {
    const adoptedAt = "2025-06-20";
    expect(
      listAnniversariesForMonth({ birthDate: null, adoptedAt }, 2025, 6)
        .adoptions,
    ).toEqual([{ date: "2025-06-20", years: 0 }]);
    expect(
      listAnniversariesForMonth({ birthDate: null, adoptedAt }, 2025, 7)
        .adoptions,
    ).toEqual([]);
    expect(
      listAnniversariesForMonth({ birthDate: null, adoptedAt }, 2027, 6)
        .adoptions,
    ).toEqual([{ date: "2027-06-20", years: 2 }]);
  });

  it("2/29 のお迎え記念日は、うるう年でない年は 2/28 にする", () => {
    expect(
      listAnniversariesForMonth(
        { birthDate: null, adoptedAt: "2024-02-29" },
        2026,
        2,
      ).adoptions,
    ).toEqual([{ date: "2026-02-28", years: 2 }]);
  });
});

describe("formatBirthdayRecord", () => {
  it.each([
    [0, "生まれた日"],
    [3, "生後3ヶ月"],
    [12, "1歳の誕生日"],
    [36, "3歳の誕生日"],
  ])("生後 %i ヶ月は「%s」", (ageMonths, expected) => {
    expect(formatBirthdayRecord({ date: "2026-05-10", ageMonths })).toBe(
      expected,
    );
  });
});

describe("formatAdoptionRecord", () => {
  it.each([
    [0, "お迎えした日"],
    [2, "お迎えして2年"],
  ])("%i 年は「%s」", (years, expected) => {
    expect(formatAdoptionRecord({ date: "2026-05-10", years })).toBe(expected);
  });
});
