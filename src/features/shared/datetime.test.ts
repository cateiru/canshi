import { describe, expect, it } from "vitest";
import {
  combineDateTimeUtc,
  formatDateTimeUtc,
  getLocalNowParts,
  splitDateTimeUtc,
} from "./datetime";

describe("combineDateTimeUtc", () => {
  it("日付と時刻の文字列を UTC の Date に結合する", () => {
    const date = combineDateTimeUtc("2026-09-07", "08:30");
    expect(date.toISOString()).toBe("2026-09-07T08:30:00.000Z");
  });
});

describe("splitDateTimeUtc", () => {
  it("UTC の Date を日付・時刻の文字列に分解する", () => {
    const result = splitDateTimeUtc(new Date("2026-09-07T08:30:00.000Z"));
    expect(result).toEqual({ date: "2026-09-07", time: "08:30" });
  });
});

describe("formatDateTimeUtc", () => {
  it("日付と時刻をスペース区切りの文字列にする", () => {
    const result = formatDateTimeUtc(new Date("2026-09-07T08:30:00.000Z"));
    expect(result).toBe("2026-09-07 08:30");
  });
});

describe("getLocalNowParts", () => {
  it("UTC変換せずローカル表記の年月日・時刻をそのまま返す", () => {
    // ローカルタイムゾーンでの 2026-09-07 08:30（UTC変換されないことを確認するため
    // toISOString は使わず、Date のローカルコンストラクタで作る）
    const date = new Date(2026, 8, 7, 8, 30);
    const result = getLocalNowParts(date);
    expect(result).toEqual({ date: "2026-09-07", time: "08:30" });
  });

  it("1桁の月日・時刻をゼロ埋めする", () => {
    const date = new Date(2026, 0, 5, 3, 5);
    const result = getLocalNowParts(date);
    expect(result).toEqual({ date: "2026-01-05", time: "03:05" });
  });
});
