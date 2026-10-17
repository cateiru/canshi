import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarSwipeArea } from "./CalendarSwipeArea";

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const PREV_HREF = "/cats/cat-1/timeline?ym=2026-09";
const NEXT_HREF = "/cats/cat-1/timeline?ym=2026-11";

function renderArea(onDayClick = vi.fn()) {
  render(
    <CalendarSwipeArea
      aria-label="日付を選択"
      prevHref={PREV_HREF}
      nextHref={NEXT_HREF}
    >
      <a
        href="/cats/cat-1/timeline?date=2026-10-17"
        onClick={(event) => {
          event.preventDefault();
          onDayClick();
        }}
      >
        17
      </a>
    </CalendarSwipeArea>,
  );
  return {
    area: screen.getByRole("region", { name: "日付を選択" }),
    day: screen.getByRole("link", { name: "17" }),
    onDayClick,
  };
}

/** マウスで from から to まで押したまま動かして離す */
function dragWithMouse(
  target: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const base = { pointerId: 1, pointerType: "mouse", button: 0 };
  fireEvent.pointerDown(target, { ...base, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(target, { ...base, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(target, { ...base, clientX: to.x, clientY: to.y });
}

/** 指で from から to までなぞって離す */
function swipeWithTouch(
  target: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  fireEvent.touchStart(target, {
    touches: [{ clientX: from.x, clientY: from.y }],
  });
  fireEvent.touchMove(target, {
    touches: [{ clientX: to.x, clientY: to.y }],
  });
  fireEvent.touchEnd(target, {
    touches: [],
    changedTouches: [{ clientX: to.x, clientY: to.y }],
  });
}

describe("CalendarSwipeArea", () => {
  beforeEach(() => {
    router.push.mockReset();
  });

  it("マウスで左へドラッグすると次の月へ移動する", () => {
    const { day } = renderArea();
    dragWithMouse(day, { x: 200, y: 100 }, { x: 100, y: 110 });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(NEXT_HREF);
  });

  it("マウスで右へドラッグすると前の月へ移動する", () => {
    const { day } = renderArea();
    dragWithMouse(day, { x: 100, y: 100 }, { x: 200, y: 90 });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(PREV_HREF);
  });

  it("ドラッグした量が少ないときは移動しない", () => {
    const { day } = renderArea();
    dragWithMouse(day, { x: 100, y: 100 }, { x: 140, y: 100 });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("縦方向に大きく動かしたときは移動しない", () => {
    const { day } = renderArea();
    dragWithMouse(day, { x: 100, y: 100 }, { x: 180, y: 200 });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("右クリックでドラッグしても移動しない", () => {
    const { day } = renderArea();
    const base = { pointerId: 1, pointerType: "mouse", button: 2 };
    fireEvent.pointerDown(day, { ...base, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(day, { ...base, clientX: 200, clientY: 100 });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("ドラッグしたあとのクリックでは日付を選ばない", () => {
    const { day, onDayClick } = renderArea();
    dragWithMouse(day, { x: 200, y: 100 }, { x: 100, y: 100 });
    fireEvent.click(day);
    expect(onDayClick).not.toHaveBeenCalled();

    // 打ち消すのはドラッグ直後の 1 回だけ
    fireEvent.click(day);
    expect(onDayClick).toHaveBeenCalledOnce();
  });

  it("ほとんど動かさずに押して離したときは日付を選べる", () => {
    const { day, onDayClick } = renderArea();
    dragWithMouse(day, { x: 100, y: 100 }, { x: 103, y: 101 });
    fireEvent.click(day);
    expect(onDayClick).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("指で左右へスワイプすると前後の月へ移動する", () => {
    const { day } = renderArea();
    swipeWithTouch(day, { x: 200, y: 100 }, { x: 100, y: 100 });
    expect(router.push).toHaveBeenLastCalledWith(NEXT_HREF);

    swipeWithTouch(day, { x: 100, y: 100 }, { x: 200, y: 100 });
    expect(router.push).toHaveBeenLastCalledWith(PREV_HREF);
  });

  it("スワイプの途中でブラウザから pointercancel が届いても移動する", () => {
    const { day } = renderArea();
    fireEvent.touchStart(day, { touches: [{ clientX: 200, clientY: 100 }] });
    // ブラウザがタッチの動きをスクロールとして引き取ると、タッチのポインターは打ち切られる
    fireEvent.pointerCancel(day, { pointerId: 2, pointerType: "touch" });
    fireEvent.touchMove(day, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(day, {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(NEXT_HREF);
  });

  it("マウスのドラッグが pointercancel で打ち切られたときは移動しない", () => {
    const { day } = renderArea();
    const base = { pointerId: 1, pointerType: "mouse", button: 0 };
    fireEvent.pointerDown(day, { ...base, clientX: 200, clientY: 100 });
    fireEvent.pointerCancel(day, base);
    fireEvent.pointerUp(day, { ...base, clientX: 100, clientY: 100 });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("スワイプの大半がカレンダーの横スクロールに使われたときは移動しない", () => {
    const { area, day } = renderArea();
    fireEvent.touchStart(day, { touches: [{ clientX: 200, clientY: 100 }] });
    // 狭い画面でカレンダー自体が横にスクロールし、端を越えて動かしたのは 20px だけ
    area.scrollLeft = 80;
    fireEvent.touchEnd(day, {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("横スクロールが端に達してからさらに大きく動かしたときは移動する", () => {
    const { area, day } = renderArea();
    fireEvent.touchStart(day, { touches: [{ clientX: 300, clientY: 100 }] });
    // わずかに残っていた横スクロールを使い切ってから、さらに 194px 動かした
    area.scrollLeft = 6;
    fireEvent.touchEnd(day, {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(NEXT_HREF);
  });

  it("2 本指で操作したときは移動しない", () => {
    const { day } = renderArea();
    fireEvent.touchStart(day, {
      touches: [
        { clientX: 200, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ],
    });
    fireEvent.touchEnd(day, {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(router.push).not.toHaveBeenCalled();
  });
});
