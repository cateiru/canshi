"use client";

import { useRouter } from "next/navigation";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
  useRef,
} from "react";

/** 月を送るのに必要な横方向の移動量（px） */
export const SWIPE_THRESHOLD = 60;
/** これを超えて動かしたら、指やマウスを離したあとのクリック（日付の選択）を打ち消す */
const CLICK_SUPPRESS_DISTANCE = 8;

/**
 * 横スクロールの位置を、実際にスクロールできる範囲（0〜scrollWidth - clientWidth）に収めて返す。
 * iOS Safari では端で弾むあいだ scrollLeft がこの範囲を越えるため、そのまま差を取ると
 * 端を越えて動かした分までスクロールに使われたものとして数えてしまう
 */
function getScrollLeft(area: HTMLElement | null): number {
  if (!area) {
    return 0;
  }
  const max = Math.max(area.scrollWidth - area.clientWidth, 0);
  return Math.min(Math.max(area.scrollLeft, 0), max);
}

type Gesture = {
  x: number;
  y: number;
  scrollLeft: number;
  pointerId?: number;
  moved: boolean;
};

type CalendarSwipeAreaProps = {
  className?: string;
  /** スクリーンリーダー向けのラベル */
  "aria-label": string;
  prevHref: string;
  nextHref: string;
  children: ReactNode;
};

/**
 * 左右へドラッグ（タッチではスワイプ）すると前月・次月へ移動する、カレンダーの横スクロール領域。
 *
 * タッチはブラウザ標準の横スクロールを妨げないようタッチイベントで受け、指の移動量のうち
 * カレンダー自体の横スクロールに使われた分を除いた残り（端に達してからさらに動かした分）で
 * 月を送るかを決める。マウス・ペンはポインターイベントで受ける。
 */
export function CalendarSwipeArea({
  className,
  "aria-label": ariaLabel,
  prevHref,
  nextHref,
  children,
}: CalendarSwipeAreaProps) {
  const router = useRouter();
  const areaRef = useRef<HTMLElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const suppressClickRef = useRef(false);

  function start(x: number, y: number, pointerId?: number) {
    gestureRef.current = {
      x,
      y,
      scrollLeft: getScrollLeft(areaRef.current),
      pointerId,
      moved: false,
    };
  }

  function move(x: number, y: number) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.moved) {
      return;
    }
    if (Math.hypot(x - gesture.x, y - gesture.y) > CLICK_SUPPRESS_DISTANCE) {
      gesture.moved = true;
      // 押した時点でキャプチャすると click の対象が日付のリンクから外れてタップが効かなくなるため、
      // ドラッグと判断できてから領域の外へ出ても追えるようにする
      const area = areaRef.current;
      if (gesture.pointerId != null && area?.setPointerCapture) {
        area.setPointerCapture(gesture.pointerId);
      }
    }
  }

  function end(x: number, y: number) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture) {
      return;
    }
    if (
      gesture.moved ||
      Math.hypot(x - gesture.x, y - gesture.y) > CLICK_SUPPRESS_DISTANCE
    ) {
      suppressClickRef.current = true;
    }
    const dx = x - gesture.x;
    const dy = y - gesture.y;
    // 狭い画面ではカレンダーが少しだけ横スクロールできることがあるため、スクロールしたら
    // 一律に無視するのではなく、端を越えて動かした分が閾値に届いたかで判断する
    const scrolled = Math.abs(
      getScrollLeft(areaRef.current) - gesture.scrollLeft,
    );
    if (
      Math.abs(dx) - scrolled < SWIPE_THRESHOLD ||
      Math.abs(dx) <= Math.abs(dy)
    ) {
      return;
    }
    // 右へ動かすと前の月、左へ動かすと次の月
    router.push(dx > 0 ? prevHref : nextHref);
  }

  function cancel() {
    gestureRef.current = null;
  }

  // タッチでスワイプしたあとはクリックが発生しないことがあるため、打ち消しの印が残ったまま
  // キーボードで日付を選んだときに効かなくならないようにする
  function handleKeyDownCapture() {
    suppressClickRef.current = false;
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    // タッチはタッチイベントで扱う。マウスは主ボタンだけを対象にする
    if (event.pointerType === "touch" || event.button !== 0) {
      return;
    }
    suppressClickRef.current = false;
    start(event.clientX, event.clientY, event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerId === gestureRef.current?.pointerId) {
      move(event.clientX, event.clientY);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (event.pointerId === gestureRef.current?.pointerId) {
      end(event.clientX, event.clientY);
    }
  }

  // タッチではブラウザがスクロールを引き取ると pointercancel が届くが、タッチのジェスチャーは
  // タッチイベントで追っているため、マウス・ペンで追っているポインターのときだけ打ち切る
  function handlePointerCancel(event: PointerEvent<HTMLElement>) {
    if (event.pointerId === gestureRef.current?.pointerId) {
      cancel();
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    // 2 本指（拡大・縮小）は対象にしない
    if (event.touches.length !== 1) {
      cancel();
      return;
    }
    const touch = event.touches[0];
    suppressClickRef.current = false;
    start(touch.clientX, touch.clientY);
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    if (touch && gestureRef.current?.pointerId == null) {
      move(touch.clientX, touch.clientY);
    }
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    if (touch && gestureRef.current?.pointerId == null) {
      end(touch.clientX, touch.clientY);
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <section
      ref={areaRef}
      className={className}
      aria-label={ariaLabel}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: 横スクロールするカレンダーをキーボードでも操作できるようにする
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={cancel}
      onClickCapture={handleClickCapture}
      onKeyDownCapture={handleKeyDownCapture}
      // マウスで日付のリンクをドラッグしたときに、ブラウザ標準のリンクのドラッグが始まらないようにする
      onDragStart={(event) => event.preventDefault()}
    >
      {children}
    </section>
  );
}
