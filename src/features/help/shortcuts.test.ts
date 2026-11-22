import { describe, expect, it } from "vitest";
import {
  buildHelpShortcuts,
  type HelpShortcutContext,
  type HelpShortcutTarget,
} from "./shortcuts";

const context: HelpShortcutContext = {
  households: [
    { id: "household-1", name: "わが家", role: "owner" },
    { id: "household-2", name: "実家", role: "member" },
  ],
  cats: [
    { id: "cat-1", name: "たま", memorialDate: null },
    { id: "cat-2", name: "みけ", memorialDate: "2024-06-20" },
  ],
};

const ALL_TARGETS: HelpShortcutTarget[] = [
  "household-new",
  "household-invitation",
  "cat-new",
  "cat-detail",
  "food-products",
  "feeding-schedules",
  "record-exports",
  "notification-settings",
  "appearance-settings",
  "cat-notification-settings",
];

describe("buildHelpShortcuts", () => {
  it.each(ALL_TARGETS)(
    "ログインしていなければ %s の導線を出さない",
    (target) => {
      expect(buildHelpShortcuts(target, null)).toEqual([]);
    },
  );

  it("家やねこがなくても、家の作成・通知設定・見た目設定の導線は出す", () => {
    const empty: HelpShortcutContext = { households: [], cats: [] };
    expect(buildHelpShortcuts("household-new", empty)).toEqual([
      { href: "/settings/households/new", label: "家を作成する" },
    ]);
    expect(buildHelpShortcuts("notification-settings", empty)).toEqual([
      { href: "/settings/notifications", label: "通知設定" },
    ]);
    expect(buildHelpShortcuts("appearance-settings", empty)).toEqual([
      { href: "/settings/appearance", label: "見た目設定" },
    ]);
    for (const target of ALL_TARGETS.filter(
      (target) =>
        target !== "household-new" &&
        target !== "notification-settings" &&
        target !== "appearance-settings",
    )) {
      expect(buildHelpShortcuts(target, empty)).toEqual([]);
    }
  });

  it("招待の導線はオーナーの家だけに出す", () => {
    expect(buildHelpShortcuts("household-invitation", context)).toEqual([
      { href: "/settings/households/household-1", label: "わが家の設定" },
    ]);
  });

  it("家ごとの画面の導線は所属するすべての家に出す", () => {
    expect(buildHelpShortcuts("cat-new", context)).toEqual([
      {
        href: "/cats/new?householdId=household-1",
        label: "わが家にねこを登録する",
      },
      {
        href: "/cats/new?householdId=household-2",
        label: "実家にねこを登録する",
      },
    ]);
    expect(
      buildHelpShortcuts("food-products", context).map((s) => s.href),
    ).toEqual([
      "/food-products?householdId=household-1",
      "/food-products?householdId=household-2",
    ]);
    expect(
      buildHelpShortcuts("feeding-schedules", context).map((s) => s.href),
    ).toEqual([
      "/settings/households/household-1/feeding-schedules",
      "/settings/households/household-2/feeding-schedules",
    ]);
    expect(buildHelpShortcuts("record-exports", context)).toEqual([
      {
        href: "/settings/households/household-1/record-exports",
        label: "わが家の記録の出力",
      },
      {
        href: "/settings/households/household-2/record-exports",
        label: "実家の記録の出力",
      },
    ]);
  });

  it("ねこの導線はメモリーへ移したねこを除く", () => {
    expect(buildHelpShortcuts("cat-detail", context)).toEqual([
      { href: "/cats/cat-1", label: "たまの画面" },
    ]);
    expect(buildHelpShortcuts("cat-notification-settings", context)).toEqual([
      { href: "/cats/cat-1/notification-settings", label: "たまの通知設定" },
    ]);
  });
});
