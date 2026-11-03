import { describe, expect, it } from "vitest";
import { calculateElapsedDays } from "./calculations";

describe("calculateElapsedDays", () => {
  it("同じ日なら0を返す", () => {
    expect(
      calculateElapsedDays(
        new Date("2026-09-07T08:00:00.000Z"),
        new Date("2026-09-07T20:00:00.000Z"),
      ),
    ).toBe(0);
  });

  it("暦日の差分を返す（時刻をまたいでも1日として数える）", () => {
    expect(
      calculateElapsedDays(
        new Date("2026-09-05T23:00:00.000Z"),
        new Date("2026-09-06T01:00:00.000Z"),
      ),
    ).toBe(1);
  });

  it("複数日経過した場合も正しく計算する", () => {
    expect(
      calculateElapsedDays(
        new Date("2026-09-01T00:00:00.000Z"),
        new Date("2026-09-10T00:00:00.000Z"),
      ),
    ).toBe(9);
  });
});
