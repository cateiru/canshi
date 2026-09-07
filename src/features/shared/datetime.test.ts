import { describe, expect, it } from "vitest";
import {
  combineDateTimeUtc,
  formatDateTimeUtc,
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
