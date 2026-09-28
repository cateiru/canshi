import { describe, expect, it } from "vitest";
import {
  calculateAge,
  calculateTimeSinceAdoption,
  formatAge,
  formatTimeSinceAdoption,
} from "./age";

describe("calculateAge", () => {
  it("誕生日を迎えている場合は満年齢を計算する", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateAge("2020-04-01", now)).toEqual({
      years: 6,
      months: 5,
      days: 5,
    });
  });

  it("誕生日を迎えていない場合は前月までで計算する", () => {
    const now = new Date("2026-03-31T00:00:00Z");
    expect(calculateAge("2020-04-01", now)).toEqual({
      years: 5,
      months: 11,
      days: 30,
    });
  });

  it("誕生日当日は年齢を1つ繰り上げる", () => {
    const now = new Date("2026-04-01T00:00:00Z");
    expect(calculateAge("2020-04-01", now)).toEqual({
      years: 6,
      months: 0,
      days: 0,
    });
  });

  it("生後1年未満は0歳として日数まで計算する", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateAge("2026-06-01", now)).toEqual({
      years: 0,
      months: 3,
      days: 5,
    });
  });

  it("生年月日が未来の場合は0歳0ヶ月0日", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateAge("2027-01-01", now)).toEqual({
      years: 0,
      months: 0,
      days: 0,
    });
    expect(calculateAge("2026-09-20", now)).toEqual({
      years: 0,
      months: 0,
      days: 0,
    });
  });

  it("生まれた当日は0歳0ヶ月0日", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateAge("2026-09-06", now)).toEqual({
      years: 0,
      months: 0,
      days: 0,
    });
  });
});

describe("formatAge", () => {
  it("年と月がある場合は両方表示する", () => {
    expect(formatAge({ years: 6, months: 5, days: 5 })).toBe("6歳5ヶ月");
  });

  it("月が0の場合は年のみ表示する", () => {
    expect(formatAge({ years: 6, months: 0, days: 0 })).toBe("6歳");
  });

  it("1歳未満で月と日がある場合は両方表示する", () => {
    expect(formatAge({ years: 0, months: 3, days: 15 })).toBe("3ヶ月と15日");
  });

  it("1歳未満で日が0の場合は月のみ表示する", () => {
    expect(formatAge({ years: 0, months: 3, days: 0 })).toBe("3ヶ月");
  });

  it("1歳未満で月が0の場合は日のみ表示する", () => {
    expect(formatAge({ years: 0, months: 0, days: 15 })).toBe("15日");
  });

  it("生後0日は0日と表示する", () => {
    expect(formatAge({ years: 0, months: 0, days: 0 })).toBe("0日");
  });
});

describe("calculateTimeSinceAdoption", () => {
  it("お迎え日からの経過期間を年齢と同じ数え方で計算する", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateTimeSinceAdoption("2025-06-01", now)).toEqual({
      years: 1,
      months: 3,
      days: 5,
    });
  });

  it("お迎え日当日は0年0ヶ月0日", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateTimeSinceAdoption("2026-09-06", now)).toEqual({
      years: 0,
      months: 0,
      days: 0,
    });
  });

  it("年をまたいでも正しく計算する", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    expect(calculateTimeSinceAdoption("2025-12-31", now)).toEqual({
      years: 0,
      months: 0,
      days: 5,
    });
  });

  it("お迎え日が未来の場合はまだお迎えしていないため null を返す", () => {
    const now = new Date("2026-09-06T00:00:00Z");
    expect(calculateTimeSinceAdoption("2027-01-01", now)).toBeNull();
    expect(calculateTimeSinceAdoption("2026-09-20", now)).toBeNull();
  });
});

describe("formatTimeSinceAdoption", () => {
  it("年と月がある場合は両方表示する", () => {
    expect(formatTimeSinceAdoption({ years: 1, months: 3, days: 5 })).toBe(
      "1年3ヶ月",
    );
  });

  it("月が0の場合は年のみ表示する", () => {
    expect(formatTimeSinceAdoption({ years: 1, months: 0, days: 0 })).toBe(
      "1年",
    );
  });

  it("1年未満で月と日がある場合は両方表示する", () => {
    expect(formatTimeSinceAdoption({ years: 0, months: 3, days: 15 })).toBe(
      "3ヶ月と15日",
    );
  });

  it("1年未満で月が0の場合は日のみ表示する", () => {
    expect(formatTimeSinceAdoption({ years: 0, months: 0, days: 15 })).toBe(
      "15日",
    );
  });

  it("お迎え当日は0日と表示する", () => {
    expect(formatTimeSinceAdoption({ years: 0, months: 0, days: 0 })).toBe(
      "0日",
    );
  });
});
