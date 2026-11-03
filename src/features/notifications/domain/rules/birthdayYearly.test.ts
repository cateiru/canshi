import { describe, expect, it } from "vitest";
import { evaluateBirthdayYearly } from "./birthdayYearly";

describe("evaluateBirthdayYearly", () => {
  it("誕生日と同じ月日なら発火する", () => {
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2020-09-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toEqual({
      catId: "cat-1",
      kind: "birthday_yearly",
      referenceId: null,
      dedupeKey: "cat-1:birthday_yearly:6",
      dueAt: new Date("2026-09-11T00:00:00.000Z"),
      years: 6,
    });
  });

  it("誕生日と異なる日は発火しない", () => {
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2020-09-11",
      new Date("2026-09-10T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("生まれた日そのもの（0歳）は発火しない", () => {
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2026-09-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("無効化されている場合は発火しない", () => {
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2020-09-11",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      false,
    );
    expect(candidate).toBeNull();
  });

  it("生年月日が未設定の場合は発火しない", () => {
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      null,
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("タイムゾーン境界：JST では日付が変わっていれば発火する", () => {
    // UTC 2026-09-10 15:30 = JST 2026-09-11 00:30
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2020-09-11",
      new Date("2026-09-10T15:30:00.000Z"),
      "Asia/Tokyo",
      true,
    );
    expect(candidate?.years).toBe(6);
  });

  it("タイムゾーン境界：JST でまだ日付が変わっていなければ発火しない", () => {
    // UTC 2026-09-10 14:00 = JST 2026-09-10 23:00（まだ9/11になっていない）
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2020-09-11",
      new Date("2026-09-10T14:00:00.000Z"),
      "Asia/Tokyo",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("2/29 生まれは非うるう年の 2/28 に発火する", () => {
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2020-02-29",
      new Date("2026-02-28T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toEqual({
      catId: "cat-1",
      kind: "birthday_yearly",
      referenceId: null,
      dedupeKey: "cat-1:birthday_yearly:6",
      dueAt: new Date("2026-02-28T00:00:00.000Z"),
      years: 6,
    });
  });

  it("2/29 生まれは非うるう年の 2/27 には発火しない", () => {
    const candidate = evaluateBirthdayYearly(
      "cat-1",
      "2020-02-29",
      new Date("2026-02-27T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(candidate).toBeNull();
  });

  it("2/29 生まれはうるう年の 2/29 に発火する（2/28 には発火しない）", () => {
    const onFeb29 = evaluateBirthdayYearly(
      "cat-1",
      "2020-02-29",
      new Date("2024-02-29T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(onFeb29?.years).toBe(4);

    const onFeb28 = evaluateBirthdayYearly(
      "cat-1",
      "2020-02-29",
      new Date("2024-02-28T00:00:00.000Z"),
      "UTC",
      true,
    );
    expect(onFeb28).toBeNull();
  });
});
