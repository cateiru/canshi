import { describe, expect, it } from "vitest";
import { groupCatsByHousehold } from "./groupCats";

describe("groupCatsByHousehold", () => {
  it("家の順に猫をまとめ、各家の猫の並び順を保つ", () => {
    const households = [{ id: "home" }, { id: "other" }];
    const cats = [
      { id: "mike", householdId: "other" },
      { id: "tama", householdId: "home" },
      { id: "kuro", householdId: "other" },
    ];

    expect(groupCatsByHousehold(households, cats)).toEqual([
      {
        household: { id: "home" },
        cats: [{ id: "tama", householdId: "home" }],
      },
      {
        household: { id: "other" },
        cats: [
          { id: "mike", householdId: "other" },
          { id: "kuro", householdId: "other" },
        ],
      },
    ]);
  });

  it("猫のいない家は空のまとまりにし、所属していない家の猫は含めない", () => {
    expect(
      groupCatsByHousehold(
        [{ id: "home" }],
        [
          { id: "tama", householdId: "stranger" },
          { id: "shiro", householdId: null },
        ],
      ),
    ).toEqual([{ household: { id: "home" }, cats: [] }]);
  });
});
