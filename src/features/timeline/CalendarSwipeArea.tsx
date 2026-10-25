"use client";

import { useRouter } from "next/navigation";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
  useLayoutEffect,
  useRef,
  ViewTransition,
} from "react";
import styles from "./CalendarSwipeArea.module.css";
import { CALENDAR_TRANSITION_TYPE } from "./calendarTransition";

/** 月を送るのに必要な横方向の移動量（px） */
export const SWIPE_THRESHOLD = 60;
/** これを超えて動かしたら、指やマウスを離したあとのクリック（日付の選択）を打ち消す */
const CLICK_SUPPRESS_DISTANCE = 8;

/** 月送りのときだけスライドさせ、日付の選択など、それ以外の遷移では動かさない */
const MONTH_SLIDE = {
  [CALENDAR_TRANSITION_TYPE.prev]: CALENDAR_TRANSITION_TYPE.prev,
  [CALENDAR_TRANSITION_TYPE.next]: CALENDAR_TRANSITION_TYPE.next,
  default: "none",
};

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

/**
 * ドラッグして月を送ったときに、カレンダーをどれだけ動かした位置から遷移したか。
 * スライドの擬似要素は html から値を受け継ぐため、html に置く（src/styles/globals.css で使う）
 */
const DRAG_DISTANCE_PROPERTY = "--calendar-drag-distance";

function setDragDistance(distance: number) {
  const root = document.documentElement;
  if (distance === 0) {
    root.style.removeProperty(DRAG_DISTANCE_PROPERTY);
  } else {
    root.style.setProperty(DRAG_DISTANCE_PROPERTY, `${distance}px`);
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Gesture = {
  x: number;
  y: number;
  scrollLeft: number;
  pointerId?: number;
  moved: boolean;
  /** 動かし始めの向き。縦なら画面のスクロールとみなし、カレンダーを追従させない */
  axis: "x" | "y" | null;
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
 *
 * 動かしているあいだはその残りの分だけカレンダーを追従させ、月を送るときは
 * ViewTransition で今の位置から隣の月へスライドさせる。
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

  // 位置は動かすたびに再描画しないよう、state にせず要素のスタイルを直接書き換える
  function setOffset(offset: number, { settle = false } = {}) {
    const area = areaRef.current;
    if (!area) {
      return;
    }
    area.dataset.settling = settle ? "true" : "false";
    area.style.translate = offset === 0 ? "" : `${offset}px`;
  }

  // 月が切り替わったら、ドラッグした位置から元の位置へ戻す。描画前に戻すことで、
  // ViewTransition が撮る新しい月の画像は元の位置に写る
  // biome-ignore lint/correctness/useExhaustiveDependencies: prevHref と nextHref は月が切り替わったことを検知するためだけに使う
  useLayoutEffect(() => {
    setOffset(0);
  }, [prevHref, nextHref]);

  /** 横スクロールを使い切ってから、さらに横へ動かした分（カレンダーを追従させる量） */
  function getOverflowDx(gesture: Gesture, dx: number): number {
    // 指を左へ動かす（dx < 0）とカレンダーは右へスクロールする（scrollLeft が増える）
    const remaining =
      dx + (getScrollLeft(areaRef.current) - gesture.scrollLeft);
    return Math.sign(remaining) === Math.sign(dx) ? remaining : 0;
  }

  function start(x: number, y: number, pointerId?: number) {
    // 前の月送りがまだ終わっていないなどで位置がずれたままでも、新しい操作は元の位置から始める
    setOffset(0);
    setDragDistance(0);
    gestureRef.current = {
      x,
      y,
      scrollLeft: getScrollLeft(areaRef.current),
      pointerId,
      moved: false,
      axis: null,
    };
  }

  function move(x: number, y: number) {
    const gesture = gestureRef.current;
    if (!gesture) {
      return;
    }
    const dx = x - gesture.x;
    const dy = y - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) > CLICK_SUPPRESS_DISTANCE) {
      gesture.moved = true;
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      // 押した時点でキャプチャすると click の対象が日付のリンクから外れてタップが効かなくなるため、
      // ドラッグと判断できてから領域の外へ出ても追えるようにする
      const area = areaRef.current;
      if (gesture.pointerId != null && area?.setPointerCapture) {
        area.setPointerCapture(gesture.pointerId);
      }
    }
    if (gesture.axis === "x" && !prefersReducedMotion()) {
      setOffset(getOverflowDx(gesture, dx));
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
      // 縦に動かし始めたときは画面のスクロールとみなし、途中で横へ動かしても月は送らない
      gesture.axis === "y" ||
      Math.abs(dx) - scrolled < SWIPE_THRESHOLD ||
      Math.abs(dx) <= Math.abs(dy)
    ) {
      setOffset(0, { settle: true });
      return;
    }
    // 右へ動かすと前の月、左へ動かすと次の月。動かした位置のまま遷移し、そこからスライドさせる
    const direction = dx > 0 ? "prev" : "next";
    setDragDistance(
      gesture.axis === "x" && !prefersReducedMotion()
        ? Math.abs(getOverflowDx(gesture, dx))
        : 0,
    );
    router.push(direction === "prev" ? prevHref : nextHref, {
      transitionTypes: [CALENDAR_TRANSITION_TYPE[direction]],
    });
  }

  function cancel() {
    gestureRef.current = null;
    setOffset(0, { settle: true });
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
    <ViewTransition
      update={MONTH_SLIDE}
      default="none"
      // スライドし終えたら、「前の月」「次の月」のボタンで移動したときに残らないよう消す
      onUpdate={() => () => setDragDistance(0)}
    >
      {/* ドラッグで動かしたカレンダーや、スライドする月の画像がカードの外へはみ出さないよう切り取る */}
      <div className={styles.viewport}>
        <section
          ref={areaRef}
          className={className ? `${styles.area} ${className}` : styles.area}
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
      </div>
    </ViewTransition>
  );
}
