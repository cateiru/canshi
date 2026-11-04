import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestResolved } from "./useLatestResolved";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useLatestResolved", () => {
  it("Promise ではない値はそのまま返す", () => {
    const { result } = renderHook(() => useLatestResolved("value", "initial"));
    expect(result.current).toEqual({ value: "value", pending: false });
  });

  it("解決するまでは initial を返し、解決したらその値を返す", async () => {
    const first = deferred<string>();
    const { result } = renderHook(() =>
      useLatestResolved(first.promise, "initial"),
    );
    expect(result.current).toEqual({ value: "initial", pending: true });

    await act(async () => {
      first.resolve("first");
    });
    expect(result.current).toEqual({ value: "first", pending: false });
  });

  it("次の Promise が解決するまでは直前に解決した値を使い続ける", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(
      ({ source }) => useLatestResolved(source, "initial"),
      { initialProps: { source: first.promise } },
    );
    await act(async () => {
      first.resolve("first");
    });

    rerender({ source: second.promise });
    expect(result.current).toEqual({ value: "first", pending: true });

    await act(async () => {
      second.resolve("second");
    });
    expect(result.current).toEqual({ value: "second", pending: false });
  });

  it("差し替える前の Promise があとから解決しても、その値は使わない", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(
      ({ source }) => useLatestResolved(source, "initial"),
      { initialProps: { source: first.promise } },
    );
    rerender({ source: second.promise });

    await act(async () => {
      first.resolve("first");
    });
    expect(result.current).toEqual({ value: "initial", pending: true });

    await act(async () => {
      second.resolve("second");
    });
    expect(result.current).toEqual({ value: "second", pending: false });
  });

  it("失敗したときは直前の値のまま読み込み中を終える", async () => {
    const first = deferred<string>();
    const { result } = renderHook(() =>
      useLatestResolved(first.promise, "initial"),
    );
    await act(async () => {
      first.reject(new Error("failed"));
    });
    expect(result.current).toEqual({ value: "initial", pending: false });
  });
});
