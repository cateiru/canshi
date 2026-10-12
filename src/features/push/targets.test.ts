import { describe, expect, it } from "vitest";
import { buildPushAccessIndex, selectPushTargets } from "./targets";

const accessIndex = buildPushAccessIndex(
  [
    { userId: "owner", catId: "tama" },
    { userId: "owner", catId: "mike" },
    { userId: "family", catId: "tama" },
    { userId: "family", catId: "mike" },
    { userId: "neighbor", catId: "kuro" },
  ],
  [
    { userId: "owner", householdId: "home" },
    { userId: "family", householdId: "home" },
    { userId: "neighbor", householdId: "next-door" },
  ],
);

const subscriptions = [
  { id: "owner-phone", userId: "owner" },
  { id: "owner-pc", userId: "owner" },
  { id: "family-phone", userId: "family" },
  { id: "neighbor-phone", userId: "neighbor" },
  // ユーザーの導入前に登録された購読
  { id: "legacy", userId: null },
];

function targetIds(notification: {
  catId: string | null;
  householdId: string | null;
}) {
  return selectPushTargets(notification, subscriptions, accessIndex).map(
    (subscription) => subscription.id,
  );
}

describe("selectPushTargets", () => {
  it("猫についての通知は、その猫の家のメンバーの購読だけに送る", () => {
    expect(targetIds({ catId: "tama", householdId: null })).toEqual([
      "owner-phone",
      "owner-pc",
      "family-phone",
    ]);
    expect(targetIds({ catId: "kuro", householdId: null })).toEqual([
      "neighbor-phone",
    ]);
  });

  it("家についての通知は、その家のメンバーの購読だけに送る", () => {
    expect(targetIds({ catId: null, householdId: "home" })).toEqual([
      "owner-phone",
      "owner-pc",
      "family-phone",
    ]);
    expect(targetIds({ catId: null, householdId: "next-door" })).toEqual([
      "neighbor-phone",
    ]);
  });

  it("ユーザーに紐付いていない購読や、どの家にも属さない猫・メンバーのいない家の通知は送らない", () => {
    expect(targetIds({ catId: "orphan", householdId: null })).toEqual([]);
    expect(targetIds({ catId: null, householdId: "empty" })).toEqual([]);
    expect(
      selectPushTargets(
        { catId: "tama", householdId: null },
        [{ id: "legacy", userId: null }],
        accessIndex,
      ),
    ).toEqual([]);
  });
});
