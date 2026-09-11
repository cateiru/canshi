import { describe, expect, it } from "vitest";
import {
  combineDateTimeUtc,
  formatDateTimeUtc,
  getLocalNowParts,
  getNaiveUtcNow,
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

describe("getNaiveUtcNow", () => {
  it("実際のUTC時刻にJSTのオフセット（9時間）を加算した値を返す", () => {
    const result = getNaiveUtcNow(new Date("2026-09-10T20:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-09-11T05:00:00.000Z");
  });

  it("JST午前0時〜9時（実UTCでは前日）でも保存値と同じ日付になる", () => {
    // JST 9/11 08:00 は実UTCで 9/10 23:00。naive UTC として保存された
    // 「9/11 08:00 の記録」と同じ日付として比較できることを確認する
    const result = getNaiveUtcNow(new Date("2026-09-10T23:00:00.000Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-09-11");
  });
});
