import { describe, expect, it } from "vitest";
import { evaluateShampooElapsed } from "./shampooElapsed";

describe("evaluateShampooElapsed", () => {
  it("設定した月数が経過していれば発火する", () => {
    const candidate = evaluateShampooElapsed(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
      2,
      new Date("2026-07-11T10:00:00.000Z"),
    );
    expect(candidate).toEqual({
      catId: "cat-1",
      kind: "shampoo_elapsed",
      referenceId: null,
      dedupeKey: "cat-1:shampoo_elapsed:2026-07-11",
      dueAt: new Date("2026-09-11T00:00:00.000Z"),
      elapsedMonths: 2,
    });
  });

  it("まだ経過していなければ発火しない", () => {
    const candidate = evaluateShampooElapsed(
      "cat-1",
      new Date("2026-09-10T00:00:00.000Z"),
      "UTC",
      true,
      2,
      new Date("2026-07-11T10:00:00.000Z"),
    );
    expect(candidate).toBeNull();
  });

  it("一度もシャンプーしていない場合は発火しない", () => {
    const candidate = evaluateShampooElapsed(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      true,
      2,
      null,
    );
    expect(candidate).toBeNull();
  });

  it("無効化されている場合は発火しない", () => {
    const candidate = evaluateShampooElapsed(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      false,
      2,
      new Date("2026-07-11T10:00:00.000Z"),
    );
    expect(candidate).toBeNull();
  });

  it("naive UTC な発生日時はタイムゾーン変換せずに読む（二重変換しない）", () => {
    // JST 23:00 に記録した想定（naive UTC）。Intl 変換すると日付がずれてしまう
    const performedAt = new Date("2026-07-11T23:00:00.000Z");
    const candidate = evaluateShampooElapsed(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "Asia/Tokyo",
      true,
      2,
      performedAt,
    );
    expect(candidate?.dedupeKey).toBe("cat-1:shampoo_elapsed:2026-07-11");
  });

  it("タイムゾーン境界：now が JST で日付が変わっていれば発火する", () => {
    // UTC 2026-09-10 15:30 = JST 2026-09-11 00:30
    const candidate = evaluateShampooElapsed(
      "cat-1",
      new Date("2026-09-10T15:30:00.000Z"),
      "Asia/Tokyo",
      true,
      2,
      new Date("2026-07-11T00:00:00.000Z"),
    );
    expect(candidate).not.toBeNull();
  });
});
