import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPendingNavigation,
  readTrackedEntry,
  writePendingNavigation,
} from "./history";
import { NavigationTracker } from "./NavigationTracker";
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
    for (const fn of Object.values(router)) {
      fn.mockClear();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
