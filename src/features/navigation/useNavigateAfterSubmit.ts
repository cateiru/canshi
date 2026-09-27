"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  currentLocation,
  decideSubmitNavigation,
  readTrackedEntry,
  writePendingNavigation,
} from "./history";

/**
 * フォーム送信後に `href` へ遷移する関数を返す。
 * 送信したページ（作成・編集ページ）を履歴に残さないよう、
 * 直前の履歴エントリが遷移先のページなら戻り、そうでなければ今のエントリを置き換える。
 * 例えば「猫詳細 → 一覧 → 追加 → 保存」の後は一覧が表示され、ブラウザバックで猫詳細に戻る
 */
export function useNavigateAfterSubmit(): (href: string) => void {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      const type = decideSubmitNavigation(
        readTrackedEntry(),
        currentLocation(),
        href,
      );
      writePendingNavigation({ type, href });
      if (type === "back") {
        router.back();
      } else {
        router.replace(href);
      }
    },
    [router],
  );
}
