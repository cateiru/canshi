"use client";

import { useEffect, useState } from "react";

function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value != null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

type ResolvedState<T> = {
  source: PromiseLike<T> | null;
  value: T;
};

/**
 * Promise が解決するまで待たずに描画するための hook。解決するまでは、直前に解決した値
 * （まだ一度も解決していなければ initial）を返し、pending を true にする。
 *
 * use() で待つと、表示済みの画面を遷移で更新するときに遷移ごと待たされてしまうため、
 * 解決を待たずに描画したい部分（タイムラインのカレンダーのアイコンなど）で使う。
 * 失敗したときは直前の値のまま pending を false にする（エラーの表示は呼び出し側に任せる）。
 * Promise ではない値を渡したときは、そのまま返す
 */
export function useLatestResolved<T>(
  source: T | PromiseLike<T>,
  initial: T,
): { value: T; pending: boolean } {
  const [state, setState] = useState<ResolvedState<T>>(() => ({
    source: null,
    value: initial,
  }));

  useEffect(() => {
    if (!isThenable(source)) {
      return;
    }
    let active = true;
    source.then(
      (value) => {
        if (active) {
          setState({ source, value });
        }
      },
      () => {
        if (active) {
          setState((prev) => ({ source, value: prev.value }));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [source]);

  if (!isThenable(source)) {
    return { value: source, pending: false };
  }
  return { value: state.value, pending: state.source !== source };
}
