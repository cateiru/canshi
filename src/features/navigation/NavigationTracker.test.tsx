import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPendingNavigation,
  readTrackedEntry,
  writePendingNavigation,
  writeTrackedEntry,
} from "./history";
import {
  NavigationTracker,
  resetDocumentHandledForTest,
} from "./NavigationTracker";
import { useNavigateAfterSubmit } from "./useNavigateAfterSubmit";

const router = {
  back: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
};
const location = { pathname: "/", search: "" };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));

/** ブラウザの位置を変え、トラッカーに位置の変化を伝える */
function moveTo(
  rerender: (ui: React.ReactElement) => void,
  href: string,
  options: { popped?: boolean } = {},
) {
  const url = new URL(href, window.location.origin);
  window.history.replaceState(null, "", href);
  location.pathname = url.pathname;
  location.search = url.search;
  act(() => {
    rerender(<NavigationTracker />);
  });
  // 戻る・進むでは、Next.js が戻り先を描画した（effect が走った）後に popstate のリスナーが呼ばれることがある
  if (options.popped) {
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  // トラッカーは popstate を拾ってから判断するため、処理を後続のタスクに回している
  act(() => {
    vi.runAllTimers();
  });
}

/** ページの読み込みの種類（Navigation Timing の type）を差し替える */
function mockDocumentNavigationType(type: NavigationTimingType) {
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { type } as PerformanceNavigationTiming,
  ]);
}

function setup(href: string) {
  window.history.replaceState(null, "", href);
  const url = new URL(href, window.location.origin);
  location.pathname = url.pathname;
  location.search = url.search;
  const { rerender } = render(<NavigationTracker />);
  act(() => {
    vi.runAllTimers();
  });
  return { rerender };
}

function navigateAfterSubmit(href: string) {
  const { result } = renderHook(() => useNavigateAfterSubmit());
  act(() => result.current(href));
}

describe("NavigationTracker と useNavigateAfterSubmit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    resetDocumentHandledForTest();
    for (const fn of Object.values(router)) {
      fn.mockClear();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("猫詳細 → 一覧 → 追加 → 保存 では一覧に戻る", () => {
    const { rerender } = setup("/cats/tama");
    moveTo(rerender, "/cats/tama/weight-records");
    moveTo(rerender, "/cats/tama/weight-records/new");
    expect(readTrackedEntry()).toEqual({
      current: "/cats/tama/weight-records/new",
      previous: "/cats/tama/weight-records",
    });

    navigateAfterSubmit("/cats/tama/weight-records");
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();

    // 戻った先で最新の内容を取り直す
    moveTo(rerender, "/cats/tama/weight-records", { popped: true });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(readPendingNavigation()).toBeNull();
    expect(readTrackedEntry()).toEqual({
      current: "/cats/tama/weight-records",
      previous: null,
    });
  });

  it("月を切り替えた一覧から追加しても、保存後は一覧に戻る", () => {
    const { rerender } = setup("/cats/tama/expenses");
    moveTo(rerender, "/cats/tama/expenses?month=2026-08");
    // 戻るで月を戻しても、次のリンク遷移は通常どおり追跡する
    moveTo(rerender, "/cats/tama/expenses", { popped: true });
    moveTo(rerender, "/cats/tama/expenses/new");

    navigateAfterSubmit("/cats/tama/expenses");
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("遷移先が表示条件（search）を指定していれば、戻った先をその条件の一覧に置き換える", () => {
    const { rerender } = setup("/cats/tama");
    moveTo(rerender, "/cats/tama/expenses");
    moveTo(rerender, "/cats/tama/expenses/new");

    // 保存した支出の月の一覧を表示する
    const href = "/cats/tama/expenses?ym=2026-09&scope=all";
    navigateAfterSubmit(href);
    expect(router.back).toHaveBeenCalledTimes(1);

    moveTo(rerender, "/cats/tama/expenses", { popped: true });
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(href);

    moveTo(rerender, href);
    expect(readPendingNavigation()).toBeNull();
    expect(readTrackedEntry()?.current).toBe(href);
  });

  it("追加ページを直接開いた場合は置き換える", () => {
    setup("/cats/tama/weight-records/new");

    navigateAfterSubmit("/cats/tama/weight-records");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/cats/tama/weight-records");
  });

  it("置き換えた後のエントリは、置き換え前の直前を引き継ぐ", () => {
    const { rerender } = setup("/cats");
    moveTo(rerender, "/cats/new");

    navigateAfterSubmit("/cats/new-cat");
    expect(router.replace).toHaveBeenCalledWith("/cats/new-cat");
    moveTo(rerender, "/cats/new-cat");
    expect(readTrackedEntry()).toEqual({
      current: "/cats/new-cat",
      previous: "/cats",
    });
  });

  it("戻った先が想定と違うページなら、本来の遷移先に置き換える", () => {
    const { rerender } = setup("/cats/tama/weight-records/new");
    writePendingNavigation({
      type: "back",
      href: "/cats/tama/weight-records",
    });

    moveTo(rerender, "/cats/tama", { popped: true });
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/cats/tama/weight-records");
    expect(readPendingNavigation()).toEqual({
      type: "replace",
      href: "/cats/tama/weight-records",
    });
  });

  it("別のドキュメントへ戻り bfcache から復元された場合も、最新の内容を取り直す", () => {
    setup("/food-products");
    writePendingNavigation({ type: "back", href: "/food-products" });

    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
      vi.runAllTimers();
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(readPendingNavigation()).toBeNull();
  });

  it("戻る・進む以外で着いた場合は、残っていた戻る遷移の予約を捨てる", () => {
    const { rerender } = setup("/food-products/new");
    writePendingNavigation({ type: "back", href: "/food-products" });

    moveTo(rerender, "/feeding-presets/new");
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(readPendingNavigation()).toBeNull();
  });

  it("外部サイトを経由して作成ページを開いた場合は、記録が残っていても置き換える", () => {
    // 同じタブで「一覧 → 外部サイト → ブックマークから作成ページ」と移動した
    writeTrackedEntry({
      current: "/cats/tama/weight-records",
      previous: "/cats/tama",
    });
    mockDocumentNavigationType("navigate");
    setup("/cats/tama/weight-records/new");
    expect(readTrackedEntry()).toEqual({
      current: "/cats/tama/weight-records/new",
      previous: null,
    });

    navigateAfterSubmit("/cats/tama/weight-records");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/cats/tama/weight-records");
  });

  it("外部サイトを経由して一覧を開いた場合は、同じ位置の記録があっても直前を不明にする", () => {
    writeTrackedEntry({
      current: "/cats/tama/weight-records",
      previous: "/cats/tama",
    });
    mockDocumentNavigationType("navigate");
    setup("/cats/tama/weight-records");
    expect(readTrackedEntry()).toEqual({
      current: "/cats/tama/weight-records",
      previous: null,
    });
  });

  it("作成ページを再読み込みした場合は、記録していた直前のエントリに戻る", () => {
    writeTrackedEntry({
      current: "/cats/tama/weight-records/new",
      previous: "/cats/tama/weight-records",
    });
    mockDocumentNavigationType("reload");
    setup("/cats/tama/weight-records/new");

    navigateAfterSubmit("/cats/tama/weight-records");
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
