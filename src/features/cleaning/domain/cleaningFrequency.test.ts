import { describe, expect, it } from "vitest";
import { cleaningFrequency, nextDueAfter } from "./cleaningFrequency";

describe("CleaningFrequency", () => {
  it("日ごとの頻度は日数を足す", () => {
    expect(
      nextDueAfter(
        cleaningFrequency(3, "days"),
        new Date("2026-01-30T10:00:00.000Z"),
      ),
    ).toEqual(new Date("2026-02-02T10:00:00.000Z"));
  });

  it("月ごとの頻度は暦月で足し、存在しない日は翌月に繰り越す", () => {
    expect(
      nextDueAfter(
        cleaningFrequency(1, "months"),
        new Date("2026-01-31T10:00:00.000Z"),
      ),
    ).toEqual(new Date("2026-03-03T10:00:00.000Z"));
  });

  it("通知時刻があれば、予定日の時刻を通知時刻に揃える", () => {
    expect(
      nextDueAfter(
        cleaningFrequency(1, "days"),
        new Date("2026-01-01T23:10:00.000Z"),
        "23:00",
      ),
    ).toEqual(new Date("2026-01-02T23:00:00.000Z"));
  });
});
