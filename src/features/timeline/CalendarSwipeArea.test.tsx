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
/** 前後の月へ移動するときに router.push へ渡す引数 */
const TO_PREV = [PREV_HREF, { transitionTypes: ["calendar-prev"] }] as const;
const TO_NEXT = [NEXT_HREF, { transitionTypes: ["calendar-next"] }] as const;

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

/** jsdom はレイアウトを計算しないため、横スクロールできる幅を与える */
function setScrollableWidth(
  area: HTMLElement,
  { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number },
) {
  Object.defineProperty(area, "scrollWidth", { value: scrollWidth });
  Object.defineProperty(area, "clientWidth", { value: clientWidth });
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
    expect(router.push).toHaveBeenCalledExactlyOnceWith(...TO_NEXT);
  });

  it("マウスで右へドラッグすると前の月へ移動する", () => {
    const { day } = renderArea();
    dragWithMouse(day, { x: 100, y: 100 }, { x: 200, y: 90 });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(...TO_PREV);
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
    expect(router.push).toHaveBeenLastCalledWith(...TO_NEXT);

    swipeWithTouch(day, { x: 100, y: 100 }, { x: 200, y: 100 });
    expect(router.push).toHaveBeenLastCalledWith(...TO_PREV);
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
    expect(router.push).toHaveBeenCalledExactlyOnceWith(...TO_NEXT);
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
    setScrollableWidth(area, { scrollWidth: 332, clientWidth: 252 });
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
    setScrollableWidth(area, { scrollWidth: 332, clientWidth: 326 });
    fireEvent.touchStart(day, { touches: [{ clientX: 300, clientY: 100 }] });
    // わずかに残っていた横スクロールを使い切ってから、さらに 194px 動かした
    area.scrollLeft = 6;
    fireEvent.touchEnd(day, {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(...TO_NEXT);
  });

  it("端で弾んで横スクロールの範囲を越えた分は、スクロールに使われた分として数えない", () => {
    const { area, day } = renderArea();
    // 横に 6px だけスクロールでき、すでに右端まで来ている
    setScrollableWidth(area, { scrollWidth: 332, clientWidth: 326 });
    area.scrollLeft = 6;
    fireEvent.touchStart(day, { touches: [{ clientX: 200, clientY: 100 }] });
    // iOS Safari では端で弾むあいだ scrollLeft が範囲を越える
    area.scrollLeft = 60;
    fireEvent.touchEnd(day, {
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(...TO_NEXT);
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

  it("ドラッグしているあいだはカレンダーが追従する", () => {
    const { area, day } = renderArea();
    const base = { pointerId: 1, pointerType: "mouse", button: 0 };
    fireEvent.pointerDown(day, { ...base, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(day, { ...base, clientX: 150, clientY: 104 });
    expect(area.style.translate).toBe("-50px");

    fireEvent.pointerMove(day, { ...base, clientX: 230, clientY: 104 });
    expect(area.style.translate).toBe("30px");
  });

  it("閾値に届かずに離したときは元の位置へ戻る", () => {
    const { area, day } = renderArea();
    dragWithMouse(day, { x: 100, y: 100 }, { x: 140, y: 100 });
    expect(area.style.translate).toBe("");
    expect(area.dataset.settling).toBe("true");
  });

  it("月を送るときは動かした位置のまま遷移し、月が切り替わったら元の位置へ戻る", () => {
    const { rerender } = render(
      <CalendarSwipeArea
        aria-label="日付を選択"
        prevHref={PREV_HREF}
        nextHref={NEXT_HREF}
      >
        10月
      </CalendarSwipeArea>,
    );
    const area = screen.getByRole("region", { name: "日付を選択" });
    dragWithMouse(area, { x: 200, y: 100 }, { x: 100, y: 100 });
    expect(router.push).toHaveBeenCalledExactlyOnceWith(...TO_NEXT);
    expect(area.style.translate).toBe("-100px");

    rerender(
      <CalendarSwipeArea
        aria-label="日付を選択"
        prevHref="/cats/cat-1/timeline?ym=2026-10"
        nextHref="/cats/cat-1/timeline?ym=2026-12"
      >
        11月
      </CalendarSwipeArea>,
    );
    expect(area.style.translate).toBe("");
  });

  it("指で動かしたときは、カレンダーの横スクロールに使われた分を除いて追従する", () => {
    const { area, day } = renderArea();
    setScrollableWidth(area, { scrollWidth: 332, clientWidth: 312 });
    fireEvent.touchStart(day, { touches: [{ clientX: 200, clientY: 100 }] });
    // 指を 50px 動かしたうち 20px はカレンダーの横スクロールに使われた
    area.scrollLeft = 20;
    fireEvent.touchMove(day, { touches: [{ clientX: 150, clientY: 100 }] });
    expect(area.style.translate).toBe("-30px");
  });

  it("縦に動かし始めたときは追従せず、途中で横へ動かしても月を送らない", () => {
    const { area, day } = renderArea();
    fireEvent.touchStart(day, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(day, { touches: [{ clientX: 198, clientY: 120 }] });
    fireEvent.touchMove(day, { touches: [{ clientX: 60, clientY: 130 }] });
    expect(area.style.translate).toBe("");
    fireEvent.touchEnd(day, {
      touches: [],
      changedTouches: [{ clientX: 60, clientY: 130 }],
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("カレンダーの幅より大きく動かしても、追従するのは幅の分まで", () => {
    const { area, day } = renderArea();
    setScrollableWidth(area, { scrollWidth: 320, clientWidth: 320 });
    const base = { pointerId: 1, pointerType: "mouse", button: 0 };
    fireEvent.pointerDown(day, { ...base, clientX: 380, clientY: 100 });
    fireEvent.pointerMove(day, { ...base, clientX: 10, clientY: 100 });
    expect(area.style.translate).toBe("-320px");
  });
});
