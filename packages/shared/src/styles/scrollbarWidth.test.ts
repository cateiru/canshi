import { afterEach, describe, expect, it, vi } from "vitest";
import { watchScrollbarWidthScript } from "./scrollbarWidth";

/** jsdom は描画しないため、測る要素の幅を差し替える */
function mockProbeWidth(offsetWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
    offsetWidth,
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    clientWidth,
  );
}

describe("watchScrollbarWidthScript", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty("--scrollbar-width");
  });

  it("<script> に書いた中身だけで、スクロールバーの幅を --scrollbar-width に入れる", () => {
    mockProbeWidth(100, 85);

    // <head> の <script> と同じく、モジュールの外で実行する
    new Function(watchScrollbarWidthScript)();

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--scrollbar-width")).toBe("15px");
    // 測るために足した要素は残さない
    expect(root.children).toHaveLength(2);
  });

  it("画面の大きさが変わったら測り直す", () => {
    mockProbeWidth(100, 85);
    new Function(watchScrollbarWidthScript)();

    mockProbeWidth(100, 100);
    window.dispatchEvent(new Event("resize"));

    expect(
      document.documentElement.style.getPropertyValue("--scrollbar-width"),
    ).toBe("0px");
  });
});
