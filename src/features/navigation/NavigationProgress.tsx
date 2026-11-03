"use client";

// `@bprogress/next/app` ではなくルートから import する。useProgress はルートからしか
// export されておらず、Provider も同じ入口から取らないと同じ実装が二重に読み込まれるため
import { AppProgressProvider, useProgress } from "@bprogress/next";
import { useEffect } from "react";
import { isPageLinkClick } from "./progress";

/**
 * ProgressProvider は描画のたびに options を設定し直すため、参照が変わらないようモジュールに置く
 */
const progressOptions = { showSpinner: false };

/**
 * リンクのクリックでバーを始める。
 * ライブラリのリンクの監視（disableAnchorClick で無効にしている）は DOM が変わったときにしか
 * リンクへハンドラを付けないため、読み込み後に DOM が変わらないページでは最初のクリックで
 * バーが出ない。代わりに document で 1 か所だけクリックを受ける。
 * React も document で click を受けており、先に登録した React の capture のハンドラ
 * （カレンダーのスワイプ後のクリックの取り消しなど）の後に実行されるため、取り消されたクリックを見分けられる
 */
function LinkClickProgress() {
  const { start } = useProgress();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (isPageLinkClick(event, window.location.href)) {
        start();
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [start]);

  return null;
}

/**
 * アプリ内のリンクで別のページへ移るあいだ、画面の上端に進み具合のバーを表示する。
 * リンクのクリックで始まり、遷移先の位置（pathname・search）に変わったら終わる
 */
export function NavigationProgress() {
  return (
    <AppProgressProvider
      color="var(--color-accent)"
      height="3px"
      options={progressOptions}
      disableAnchorClick
    >
      <LinkClickProgress />
    </AppProgressProvider>
  );
}
