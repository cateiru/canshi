import { Alert, Button } from "@canshi/shared/ui";
import type { ReactNode } from "react";
import common from "../common.module.css";
import type { ApiState } from "../useApi";

/**
 * API から読み込んだデータを表示する。読み込み中は aria-busy の文を表示し（VRT はこれが消えるのを待つ）、
 * 読み込めなかったときは理由と読み込み直すボタンを表示する
 */
export function Loadable<T>(props: {
  state: ApiState<T>;
  reload: () => void;
  children: (data: T) => ReactNode;
}) {
  const { state } = props;
  switch (state.status) {
    case "loading":
      return (
        <p className={common.muted} aria-busy="true">
          読み込み中...
        </p>
      );
    case "error":
      return (
        <div className={common.stack}>
          <Alert color="error" role="alert">
            読み込めませんでした。{state.error.message}
          </Alert>
          <div>
            <Button variant="secondary" onPress={props.reload}>
              読み込み直す
            </Button>
          </div>
        </div>
      );
    case "success":
      return props.children(state.data);
  }
}
