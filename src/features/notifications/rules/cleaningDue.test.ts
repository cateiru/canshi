import { describe, expect, it } from "vitest";
import type { CleaningTargetWithStatus } from "@/features/cleaning/targetQueries";
import { evaluateCleaningDue } from "./cleaningDue";

function makeTarget(
  overrides: Partial<CleaningTargetWithStatus["target"]> = {},
  nextDueAt: Date | null = new Date("2026-09-11T00:00:00.000Z"),
): CleaningTargetWithStatus {
  const target: CleaningTargetWithStatus["target"] = {
    id: "target-1",
    catId: "cat-1",
    name: "猫砂",
    frequencyValue: 7,
    frequencyUnit: "days",
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
  return {
    target,
    lastPerformedAt: new Date("2026-09-04T00:00:00.000Z"),
    nextDueAt,
    isOverdue: false,
  };
}

describe("evaluateCleaningDue", () => {
  it("次回予定日を迎えていれば発火する", () => {
    const candidates = evaluateCleaningDue(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      [makeTarget()],
      () => true,
    );
    expect(candidates).toEqual([
      {
        catId: "cat-1",
        kind: "cleaning_due",
        referenceId: "target-1",
        dedupeKey: "cat-1:cleaning_due:target-1:2026-09-11",
        dueAt: new Date("2026-09-11T00:00:00.000Z"),
        targetId: "target-1",
        targetName: "猫砂",
      },
    ]);
  });

  it("まだ次回予定日を迎えていなければ発火しない", () => {
    const candidates = evaluateCleaningDue(
      "cat-1",
      new Date("2026-09-10T00:00:00.000Z"),
      "UTC",
      [makeTarget()],
      () => true,
    );
    expect(candidates).toEqual([]);
  });

  it("未実施（次回予定日を計算できない）対象は発火しない", () => {
    const candidates = evaluateCleaningDue(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      [makeTarget({}, null)],
      () => true,
    );
    expect(candidates).toEqual([]);
  });

  it("無効化された対象は発火しない", () => {
    const candidates = evaluateCleaningDue(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      [makeTarget()],
      () => false,
    );
    expect(candidates).toEqual([]);
  });

  it("非アクティブな対象は発火しない", () => {
    const candidates = evaluateCleaningDue(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      [makeTarget({ isActive: false })],
      () => true,
    );
    expect(candidates).toEqual([]);
  });

  it("複数の対象があればそれぞれ候補を返す", () => {
    const candidates = evaluateCleaningDue(
      "cat-1",
      new Date("2026-09-11T00:00:00.000Z"),
      "UTC",
      [
        makeTarget({ id: "target-1", name: "猫砂" }),
        makeTarget({ id: "target-2", name: "食器" }),
      ],
      () => true,
    );
    expect(candidates.map((c) => c.referenceId)).toEqual([
      "target-1",
      "target-2",
    ]);
  });

  it("タイムゾーン境界：JST では日付が変わっていれば発火する", () => {
    // UTC 2026-09-10 15:30 = JST 2026-09-11 00:30
    const candidates = evaluateCleaningDue(
      "cat-1",
      new Date("2026-09-10T15:30:00.000Z"),
      "Asia/Tokyo",
      [makeTarget()],
      () => true,
    );
    expect(candidates).toHaveLength(1);
  });
});
