import { describe, expect, it } from "vitest";
import {
  birthdayCelebratedStorageKey,
  formatMilestoneAge,
  getBirthdayMilestone,
  getLifeStageMessage,
  toHumanAge,
  toLocalCalendarDate,
} from "./birthday";

describe("getBirthdayMilestone", () => {
  it("誕生日当日は迎えた年齢を返す", () => {
    expect(
      getBirthdayMilestone("2020-04-01", { year: 2026, month: 4, day: 1 }),
    ).toEqual({ kind: "yearly", years: 6 });
  });

  it("誕生日の前日は null", () => {
    expect(
      getBirthdayMilestone("2020-04-01", { year: 2026, month: 3, day: 31 }),
    ).toBeNull();
  });

  it("誕生日の翌日は null", () => {
    expect(
      getBirthdayMilestone("2020-04-01", { year: 2026, month: 4, day: 2 }),
    ).toBeNull();
  });

  it("1歳以上は毎月の記念日をお祝いしない", () => {
    expect(
      getBirthdayMilestone("2020-04-01", { year: 2026, month: 5, day: 1 }),
    ).toBeNull();
  });

  it("生まれた当日は null", () => {
    expect(
      getBirthdayMilestone("2026-09-26", { year: 2026, month: 9, day: 26 }),
    ).toBeNull();
  });

  it("生年月日が未来の日付なら null", () => {
    expect(
      getBirthdayMilestone("2027-09-26", { year: 2026, month: 9, day: 26 }),
    ).toBeNull();
  });

  it("1歳未満は毎月の生まれた日と同じ日に生後の月数を返す", () => {
    expect(
      getBirthdayMilestone("2026-06-15", { year: 2026, month: 7, day: 15 }),
    ).toEqual({ kind: "monthly", months: 1 });
    expect(
      getBirthdayMilestone("2025-10-15", { year: 2026, month: 9, day: 15 }),
    ).toEqual({ kind: "monthly", months: 11 });
  });

  it("1歳未満でも生まれた日と違う日は null", () => {
    expect(
      getBirthdayMilestone("2026-06-15", { year: 2026, month: 7, day: 16 }),
    ).toBeNull();
  });

  it("年をまたいでも生後の月数を数える", () => {
    expect(
      getBirthdayMilestone("2025-11-10", { year: 2026, month: 2, day: 10 }),
    ).toEqual({ kind: "monthly", months: 3 });
  });

  it("生後12ヶ月は1歳の誕生日としてお祝いする", () => {
    expect(
      getBirthdayMilestone("2025-09-26", { year: 2026, month: 9, day: 26 }),
    ).toEqual({ kind: "yearly", years: 1 });
  });

  it("生まれた日がその月にない場合は月末にお祝いする", () => {
    expect(
      getBirthdayMilestone("2026-01-31", { year: 2026, month: 2, day: 28 }),
    ).toEqual({ kind: "monthly", months: 1 });
    expect(
      getBirthdayMilestone("2026-01-31", { year: 2026, month: 4, day: 30 }),
    ).toEqual({ kind: "monthly", months: 3 });
  });

  it("生まれた日がその月にある場合は月末ではなくその日にお祝いする", () => {
    expect(
      getBirthdayMilestone("2026-01-30", { year: 2026, month: 3, day: 31 }),
    ).toBeNull();
    expect(
      getBirthdayMilestone("2026-01-30", { year: 2026, month: 3, day: 30 }),
    ).toEqual({ kind: "monthly", months: 2 });
  });

  it("2/29 生まれは非うるう年の 2/28 を誕生日として扱う", () => {
    expect(
      getBirthdayMilestone("2024-02-29", { year: 2026, month: 2, day: 28 }),
    ).toEqual({ kind: "yearly", years: 2 });
  });

  it("2/29 生まれはうるう年の 2/28 では対象外", () => {
    expect(
      getBirthdayMilestone("2024-02-29", { year: 2028, month: 2, day: 28 }),
    ).toBeNull();
  });

  it("2/29 生まれはうるう年の 2/29 を誕生日として扱う", () => {
    expect(
      getBirthdayMilestone("2024-02-29", { year: 2028, month: 2, day: 29 }),
    ).toEqual({ kind: "yearly", years: 4 });
  });

  it("2/28 生まれは非うるう年の 2/28 のみ対象", () => {
    expect(
      getBirthdayMilestone("2024-02-28", { year: 2026, month: 2, day: 28 }),
    ).toEqual({ kind: "yearly", years: 2 });
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

describe("formatMilestoneAge", () => {
  it("1歳以上は年齢、1歳未満は生後の月数で表示する", () => {
    expect(formatMilestoneAge({ kind: "yearly", years: 3 })).toBe("3歳");
    expect(formatMilestoneAge({ kind: "monthly", months: 3 })).toBe(
      "生後3ヶ月",
    );
  });
});

describe("toHumanAge", () => {
  it.each([
    [1, 15],
    [2, 24],
    [3, 28],
    [10, 56],
    [15, 76],
  ])("%i歳は人間の約%i歳", (years, humanAge) => {
    expect(toHumanAge({ kind: "yearly", years })).toBe(humanAge);
  });

  it.each([
    [1, 1],
    [2, 3],
    [3, 5],
    [6, 9],
    [9, 13],
    [11, 14],
  ])("生後%iヶ月は人間の約%i歳", (months, humanAge) => {
    expect(toHumanAge({ kind: "monthly", months })).toBe(humanAge);
  });

  it("生後の月数が増えるほど人間換算の年齢は下がらない", () => {
    const ages = Array.from({ length: 11 }, (_, index) =>
      toHumanAge({ kind: "monthly", months: index + 1 }),
    );
    for (let index = 1; index < ages.length; index++) {
      expect(ages[index]).toBeGreaterThanOrEqual(ages[index - 1]);
    }
    expect(ages[ages.length - 1]).toBeLessThan(
      toHumanAge({ kind: "yearly", years: 1 }),
    );
  });
});

describe("getLifeStageMessage", () => {
  it("年齢によってライフステージのひとことが変わる", () => {
    expect(getLifeStageMessage({ kind: "monthly", months: 3 })).toContain(
      "子猫期",
    );
    expect(getLifeStageMessage({ kind: "yearly", years: 6 })).toContain(
      "成猫期",
    );
    expect(getLifeStageMessage({ kind: "yearly", years: 7 })).toContain(
      "中年期",
    );
    expect(getLifeStageMessage({ kind: "yearly", years: 10 })).toContain(
      "中年期",
    );
    expect(getLifeStageMessage({ kind: "yearly", years: 11 })).toContain(
      "シニア期",
    );
  });
});

describe("birthdayCelebratedStorageKey", () => {
  it("猫と節目ごとにキーが分かれる", () => {
    expect(
      birthdayCelebratedStorageKey("cat-1", { kind: "yearly", years: 3 }),
    ).toBe("canshi:birthday-celebrated:cat-1:yearly:3");
    expect(
      birthdayCelebratedStorageKey("cat-1", { kind: "monthly", months: 3 }),
    ).toBe("canshi:birthday-celebrated:cat-1:monthly:3");
  });
});
