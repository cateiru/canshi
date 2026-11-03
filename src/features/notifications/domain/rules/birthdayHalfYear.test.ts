import { describe, expect, it } from "vitest";
import { evaluateBirthdayHalfYear } from "./birthdayHalfYear";

describe("evaluateBirthdayHalfYear", () => {
  it("生後6か月で発火する", () => {
    const candidate = evaluateBirthdayHalfYear(
      "cat-1",
      "2026-03-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toEqual({
      catId: "cat-1",
      kind: "birthday_half_year",
      referenceId: null,
      dedupeKey: "cat-1:birthday_half_year:6",
      dueAt: new Date("2026-09-11T00:00:00.000Z"),
      months: 6,
    });
  });

  it("生後18か月で発火する", () => {
    const candidate = evaluateBirthdayHalfYear(
      "cat-1",
      "2025-03-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate?.months).toBe(18);
  });

  it("生後12か月（誕生日と重なる節目）は発火しない", () => {
    const candidate = evaluateBirthdayHalfYear(
      "cat-1",
      "2025-09-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("節目の日でなければ発火しない", () => {
    const candidate = evaluateBirthdayHalfYear(
      "cat-1",
      "2026-03-11",
      new Date("2026-09-10T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("無効化されている場合は発火しない", () => {
    const candidate = evaluateBirthdayHalfYear(
      "cat-1",
      "2026-03-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      false,
    );
    expect(candidate).toBeNull();
  });

  it("タイムゾーン境界：JST では日付が変わっていれば発火する", () => {
    // UTC 2026-09-10 15:30 = JST 2026-09-11 00:30
    const candidate = evaluateBirthdayHalfYear(
      "cat-1",
      "2026-03-11",
      new Date("2026-09-10T15:30:00.000Z"),
      "Asia/Tokyo",
      true,
    );
    expect(candidate?.months).toBe(6);
  });
});
