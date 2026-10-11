import { describe, expect, it } from "vitest";
import {
  findFilterHousehold,
  householdSettingsBreadcrumbItems,
} from "./householdFilter";

const households = [
  { id: "home", name: "わが家" },
  { id: "other", name: "実家" },
];

describe("findFilterHousehold", () => {
  it("所属している家の ID なら、その家を返す", () => {
    expect(findFilterHousehold(households, "other")).toEqual({
      id: "other",
      name: "実家",
    });
  });

  it("未指定・所属していない家・複数指定なら null を返す", () => {
    expect(findFilterHousehold(households, undefined)).toBeNull();
    expect(findFilterHousehold(households, "unknown")).toBeNull();
    expect(findFilterHousehold(households, ["home", "other"])).toBeNull();
  });
});

describe("householdSettingsBreadcrumbItems", () => {
  it("家の詳細設定を経由したパンくずを返す", () => {
    expect(
      householdSettingsBreadcrumbItems(
        { id: "home", name: "わが家" },
        "ごはん商品一覧",
      ),
    ).toEqual([
      { label: "トップ", href: "/home" },
      { label: "設定", href: "/settings" },
      { label: "家の設定", href: "/settings/households" },
      { label: "わが家", href: "/settings/households/home" },
      { label: "ごはん商品一覧" },
    ]);
  });
});
