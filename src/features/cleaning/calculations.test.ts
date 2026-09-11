import { describe, expect, it } from "vitest";
import { calculateNextDueAt, isCleaningOverdue } from "./calculations";

describe("calculateNextDueAt", () => {
  it("単位が「日」の場合、前回実施日 + 頻度日数を返す", () => {
    const result = calculateNextDueAt(
      new Date("2026-09-01T00:00:00.000Z"),
      7,
      "days",
    );
    expect(result).toEqual(new Date("2026-09-08T00:00:00.000Z"));
  });

  it("単位が「月」の場合、前回実施日の暦月後（同じ日）を返す", () => {
    const result = calculateNextDueAt(
      new Date("2026-09-07T08:00:00.000Z"),
      2,
      "months",
    );
    expect(result).toEqual(new Date("2026-11-07T08:00:00.000Z"));
  });

  it("単位が「月」で存在しない日になる場合、翌月に繰り越す", () => {
    // 1/31 の1ヶ月後は2/31が存在しないため3/3になる（非うるう年）
    const result = calculateNextDueAt(
      new Date("2026-01-31T00:00:00.000Z"),
      1,
      "months",
    );
    expect(result).toEqual(new Date("2026-03-03T00:00:00.000Z"));
  });

  it("未実施（前回実施日がない）場合は null を返す", () => {
    expect(calculateNextDueAt(null, 7, "days")).toBeNull();
  });
});

describe("isCleaningOverdue", () => {
  it("次回予定日を過ぎていれば true を返す", () => {
    expect(
      isCleaningOverdue(
        new Date("2026-09-08T00:00:00.000Z"),
        new Date("2026-09-09T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("次回予定日ちょうどなら true を返す", () => {
    const date = new Date("2026-09-08T00:00:00.000Z");
    expect(isCleaningOverdue(date, date)).toBe(true);
  });

  it("次回予定日前なら false を返す", () => {
    expect(
      isCleaningOverdue(
        new Date("2026-09-08T00:00:00.000Z"),
        new Date("2026-09-07T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("次回予定日が計算できない（未実施）場合は false を返す", () => {
    expect(isCleaningOverdue(null, new Date())).toBe(false);
  });
});
