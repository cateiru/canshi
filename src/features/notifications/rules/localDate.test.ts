import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  compareLocalDate,
  diffDays,
  getLocalDateParts,
  getLocalTimeString,
  getNaiveLocalDateParts,
  localDateKey,
  localDateToUtcMidnight,
} from "./localDate";

describe("getLocalDateParts", () => {
  it("UTC の日付をまたぐ瞬間でも Asia/Tokyo のローカル日付に変換する", () => {
    // UTC 2026-09-10 15:30 = JST 2026-09-11 00:30
    const now = new Date("2026-09-10T15:30:00.000Z");
    expect(getLocalDateParts(now, "Asia/Tokyo")).toEqual({
      year: 2026,
      month: 9,
      day: 11,
    });
  });

  it("マイナス方向のタイムゾーンでも正しく変換する", () => {
    // UTC 2026-09-11 02:00 = ハワイ 2026-09-10 16:00
    const now = new Date("2026-09-11T02:00:00.000Z");
    expect(getLocalDateParts(now, "Pacific/Honolulu")).toEqual({
      year: 2026,
      month: 9,
      day: 10,
    });
  });
});

describe("getNaiveLocalDateParts", () => {
  it("naive UTC の発生日時から、タイムゾーン変換せずに UTC フィールドをそのまま読む", () => {
    const performedAt = new Date("2026-09-10T20:00:00.000Z");
    expect(getNaiveLocalDateParts(performedAt)).toEqual({
      year: 2026,
      month: 9,
      day: 10,
    });
  });
});

describe("getLocalTimeString", () => {
  it("HH:MM 形式のローカル時刻を返す", () => {
    const now = new Date("2026-09-10T23:05:00.000Z");
    expect(getLocalTimeString(now, "Asia/Tokyo")).toBe("08:05");
  });

  it("深夜0時を 24:00 ではなく 00:00 として返す", () => {
    const now = new Date("2026-09-10T15:00:00.000Z");
    expect(getLocalTimeString(now, "Asia/Tokyo")).toBe("00:00");
  });
});

describe("addMonths / addDays / diffDays / compareLocalDate", () => {
  it("存在しない日は翌月に繰り越す", () => {
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 3,
      day: 3,
    });
  });

  it("日数を加算する", () => {
    expect(addDays({ year: 2026, month: 9, day: 28 }, 5)).toEqual({
      year: 2026,
      month: 10,
      day: 3,
    });
  });

  it("暦日の差分を返す", () => {
    const a = { year: 2026, month: 9, day: 10 };
    const b = { year: 2026, month: 6, day: 1 };
    expect(diffDays(a, b)).toBe(101);
  });

  it("ローカル日付を比較する", () => {
    const a = { year: 2026, month: 9, day: 10 };
    const b = { year: 2026, month: 9, day: 11 };
    expect(compareLocalDate(a, b)).toBeLessThan(0);
    expect(compareLocalDate(b, a)).toBeGreaterThan(0);
    expect(compareLocalDate(a, a)).toBe(0);
  });
});

describe("localDateKey / localDateToUtcMidnight", () => {
  it("YYYY-MM-DD 形式のキーにする", () => {
    expect(localDateKey({ year: 2026, month: 3, day: 5 })).toBe("2026-03-05");
  });

  it("UTC 0時のタイムスタンプにする", () => {
    expect(
      localDateToUtcMidnight({ year: 2026, month: 3, day: 5 }).toISOString(),
    ).toBe("2026-03-05T00:00:00.000Z");
  });
});
