import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentActionsHint } from "./ConsentActionsHint";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let observerCallback: Callback | null = null;

beforeEach(() => {
  observerCallback = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: Callback) {
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHint() {
  const scrollIntoView = vi.fn();
  render(
    <>
      <div id="actions">許可するボタン</div>
      <ConsentActionsHint targetId="actions" />
    </>,
  );
  const target = document.getElementById("actions");
  if (target) {
    target.scrollIntoView = scrollIntoView;
  }
  return { scrollIntoView };
}

function intersect(isIntersecting: boolean, top: number) {
  act(() => {
    observerCallback?.([
      { isIntersecting, boundingClientRect: { top } as DOMRectReadOnly },
    ]);
  });
}

describe("ConsentActionsHint", () => {
  it("許可するボタンが画面より下にあるあいだだけ表示し、押すとボタンまでスクロールする", () => {
    const { scrollIntoView } = renderHint();
    expect(
      screen.queryByRole("button", { name: "許可するボタンへ" }),
    ).toBeNull();

    intersect(false, 2000);
    fireEvent.click(screen.getByRole("button", { name: "許可するボタンへ" }));
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    intersect(true, 400);
    expect(
      screen.queryByRole("button", { name: "許可するボタンへ" }),
    ).toBeNull();
  });

  it("許可するボタンより下までスクロールしたときは表示しない", () => {
    renderHint();

    intersect(false, -200);

    expect(
      screen.queryByRole("button", { name: "許可するボタンへ" }),
    ).toBeNull();
  });
});
