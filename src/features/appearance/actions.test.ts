import { beforeEach, describe, expect, it, vi } from "vitest";

const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));

import { saveContrastAction, saveThemeAction } from "./actions";

describe("見た目設定の保存", () => {
  beforeEach(() => {
    set.mockClear();
  });

  it("テーマを端末の cookie に長期間保存する", async () => {
    await saveThemeAction("dark");

    expect(set).toHaveBeenCalledWith(
      "canshi-theme",
      "dark",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
    expect(set.mock.calls[0][2].maxAge).toBeGreaterThan(60 * 60 * 24 * 365);
  });

  it("コントラストを端末の cookie に保存する", async () => {
    await saveContrastAction("more");

    expect(set).toHaveBeenCalledWith(
      "canshi-contrast",
      "more",
      expect.anything(),
    );
  });

  it.each([
    { label: "テーマ", action: saveThemeAction, value: "sepia" },
    { label: "テーマ", action: saveThemeAction, value: 1 },
    { label: "コントラスト", action: saveContrastAction, value: "high" },
  ])("不正な$label（$value）は保存しない", async ({ action, value }) => {
    await action(value);

    expect(set).not.toHaveBeenCalled();
  });
});
