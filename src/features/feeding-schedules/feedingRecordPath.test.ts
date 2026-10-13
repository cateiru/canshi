import { describe, expect, it } from "vitest";
import {
  householdFeedingRecordPath,
  resolveHouseholdFeedingRecordPath,
} from "./feedingRecordPath";

describe("householdFeedingRecordPath", () => {
  it("家のごはん記録の画面の URL を返す", () => {
    expect(householdFeedingRecordPath("household-1")).toBe(
      "/households/household-1/feeding-records/new",
    );
  });
});

describe("resolveHouseholdFeedingRecordPath", () => {
  it("猫が 1 匹なら、その猫のごはん記録の追加画面へ遷移する", () => {
    expect(resolveHouseholdFeedingRecordPath(["cat-1"])).toBe(
      "/cats/cat-1/feeding-records/new",
    );
  });

  it("猫が複数いるか 1 匹もいなければ、猫一覧へ遷移する", () => {
    expect(resolveHouseholdFeedingRecordPath(["cat-1", "cat-2"])).toBe("/cats");
    expect(resolveHouseholdFeedingRecordPath([])).toBe("/cats");
  });
});
