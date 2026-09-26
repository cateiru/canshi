import { describe, expect, it } from "vitest";
import {
  birthdayCelebratedStorageKey,
  getBirthdayYears,
  getLifeStageMessage,
  toHumanAge,
  toLocalCalendarDate,
} from "./birthday";

describe("getBirthdayYears", () => {
  it("誕生日当日は迎えた年齢を返す", () => {
    expect(
      getBirthdayYears("2020-04-01", { year: 2026, month: 4, day: 1 }),
    ).toBe(6);
  });

  it("誕生日の前日は null", () => {
    expect(
      getBirthdayYears("2020-04-01", { year: 2026, month: 3, day: 31 }),
    ).toBeNull();
  });

  it("誕生日の翌日は null", () => {
    expect(
      getBirthdayYears("2020-04-01", { year: 2026, month: 4, day: 2 }),
    ).toBeNull();
  });

  it("生まれた当日（0歳）は null", () => {
    expect(
      getBirthdayYears("2026-09-26", { year: 2026, month: 9, day: 26 }),
    ).toBeNull();
  });

  it("1歳の誕生日から対象になる", () => {
    expect(
      getBirthdayYears("2025-09-26", { year: 2026, month: 9, day: 26 }),
    ).toBe(1);
  });

  it("2/29 生まれは非うるう年の 2/28 を誕生日として扱う", () => {
    expect(
      getBirthdayYears("2024-02-29", { year: 2026, month: 2, day: 28 }),
    ).toBe(2);
  });

  it("2/29 生まれはうるう年の 2/28 では対象外", () => {
    expect(
      getBirthdayYears("2024-02-29", { year: 2028, month: 2, day: 28 }),
    ).toBeNull();
  });

  it("2/29 生まれはうるう年の 2/29 を誕生日として扱う", () => {
    expect(
      getBirthdayYears("2024-02-29", { year: 2028, month: 2, day: 29 }),
    ).toBe(4);
  });

  it("2/28 生まれは非うるう年の 2/28 のみ対象", () => {
    expect(
      getBirthdayYears("2024-02-28", { year: 2026, month: 2, day: 28 }),
    ).toBe(2);
  });
});

describe("toLocalCalendarDate", () => {
  it("端末のローカル日付で暦日を返す", () => {
    expect(toLocalCalendarDate(new Date(2026, 8, 26, 23, 59))).toEqual({
      year: 2026,
      month: 9,
      day: 26,
    });
  });
});

describe("toHumanAge", () => {
  it.each([
    [1, 15],
    [2, 24],
    [3, 28],
    [10, 56],
    [15, 76],
  ])("%i歳は人間の約%i歳", (catYears, humanAge) => {
    expect(toHumanAge(catYears)).toBe(humanAge);
  });
});

describe("getLifeStageMessage", () => {
  it("年齢によってライフステージのひとことが変わる", () => {
    expect(getLifeStageMessage(6)).toContain("成猫期");
    expect(getLifeStageMessage(7)).toContain("中年期");
    expect(getLifeStageMessage(10)).toContain("中年期");
    expect(getLifeStageMessage(11)).toContain("シニア期");
  });
});

describe("birthdayCelebratedStorageKey", () => {
  it("猫と年齢ごとにキーが分かれる", () => {
    expect(birthdayCelebratedStorageKey("cat-1", 3)).toBe(
      "canshi:birthday-celebrated:cat-1:3",
    );
  });
});
