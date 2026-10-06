import { describe, expect, it } from "vitest";
import { groupCatIdsByUser, selectPushTargets } from "./targets";

const catIdsByUser = groupCatIdsByUser([
  { userId: "owner", catId: "tama" },
  { userId: "owner", catId: "mike" },
  { userId: "family", catId: "tama" },
  { userId: "family", catId: "mike" },
  { userId: "neighbor", catId: "kuro" },
]);

const subscriptions = [
  { id: "owner-phone", userId: "owner" },
  { id: "owner-pc", userId: "owner" },
  { id: "family-phone", userId: "family" },
  { id: "neighbor-phone", userId: "neighbor" },
  // ユーザーの導入前に登録された購読
  { id: "legacy", userId: null },
];

describe("selectPushTargets", () => {
  it("通知の猫の家のメンバーの購読だけに送る", () => {
    expect(
      selectPushTargets({ catId: "tama" }, subscriptions, catIdsByUser).map(
        (subscription) => subscription.id,
      ),
    ).toEqual(["owner-phone", "owner-pc", "family-phone"]);
    expect(
      selectPushTargets({ catId: "kuro" }, subscriptions, catIdsByUser).map(
        (subscription) => subscription.id,
      ),
    ).toEqual(["neighbor-phone"]);
  });

  it("ユーザーに紐付いていない購読や、どの家にも属さない猫の通知は送らない", () => {
    expect(
      selectPushTargets({ catId: "orphan" }, subscriptions, catIdsByUser),
    ).toEqual([]);
    expect(
      selectPushTargets(
        { catId: "tama" },
        [{ id: "legacy", userId: null }],
        catIdsByUser,
      ),
    ).toEqual([]);
  });
});
