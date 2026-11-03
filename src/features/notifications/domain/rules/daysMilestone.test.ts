import { describe, expect, it } from "vitest";
import { evaluateDaysMilestone } from "./daysMilestone";

describe("evaluateDaysMilestone", () => {
  it("生後100日で発火する", () => {
    const candidate = evaluateDaysMilestone(
      "cat-1",
      "2026-06-03",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toEqual({
      catId: "cat-1",
      kind: "days_milestone",
      referenceId: null,
      dedupeKey: "cat-1:days_milestone:100",
      dueAt: new Date("2026-09-11T00:00:00.000Z"),
      days: 100,
    });
  });

  it("100の倍数でない日は発火しない", () => {
    const candidate = evaluateDaysMilestone(
      "cat-1",
      "2026-06-03",
      new Date("2026-09-10T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("生まれた日そのもの（0日）は発火しない", () => {
    const candidate = evaluateDaysMilestone(
      "cat-1",
      "2026-09-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("無効化されている場合は発火しない", () => {
    const candidate = evaluateDaysMilestone(
      "cat-1",
      "2026-06-03",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      false,
    );
    expect(candidate).toBeNull();
  });

  it("タイムゾーン境界：JST では日付が変わっていれば発火する", () => {
    // UTC 2026-09-10 15:30 = JST 2026-09-11 00:30（生後100日目）
    const candidate = evaluateDaysMilestone(
      "cat-1",
      "2026-06-03",
      new Date("2026-09-10T15:30:00.000Z"),
      "Asia/Tokyo",
      true,
    );
    expect(candidate?.days).toBe(100);
  });
});
