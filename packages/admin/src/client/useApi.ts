import { useCallback, useEffect, useState } from "react";
import { getJson } from "./api";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };

const LOADING = { status: "loading" } as const;

/**
 * API から読み込んだデータ。`reload` は書き込みのあとに読み込み直すときに呼ぶ。読み込み直す間は
 * 前のデータを表示したままにし、別のパスを開いたときだけ読み込み中にする
 */
export function useApi<T>(path: string) {
  const [result, setResult] = useState<{
    path: string;
    state: ApiState<T>;
  } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // version は読み込み直すきっかけとしてだけ使う
    void version;
    const controller = new AbortController();
    getJson<T>(path, controller.signal).then(
      (data) => setResult({ path, state: { status: "success", data } }),
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setResult({
          path,
          state: {
            status: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          },
        });
      },
    );
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const state: ApiState<T> =
    result && result.path === path ? result.state : LOADING;

  return { state, reload };
}
