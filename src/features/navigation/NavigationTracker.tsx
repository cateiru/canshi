"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  currentLocation,
  nextTrackedEntry,
  readPendingNavigation,
  readTrackedEntry,
  toPathname,
  writePendingNavigation,
  writeTrackedEntry,
} from "./history";

type Router = ReturnType<typeof useRouter>;

/** ページの読み込み自体がブラウザの戻る・進むによるものか */
function isBackForwardLoad(): boolean {
  const [entry] = performance.getEntriesByType("navigation") as
    | PerformanceNavigationTiming[]
    | [];
  return entry?.type === "back_forward";
}

/** 遷移先が search を指定していて、今の位置の search と違うか */
function needsSearchReplace(href: string, location: string): boolean {
  const target = new URL(href, "http://localhost");
  const current = new URL(location, "http://localhost");
  return target.search !== "" && target.search !== current.search;
}

/**
 * 今の位置に着いたときの処理。追跡状態を更新し、送信後の遷移で予約した処理を実行する。
 * @param popped 戻る・進むで着いたか
 */
function handleArrival(router: Router, popped: boolean) {
  const location = currentLocation();
  const pending = readPendingNavigation();
  const arrived =
    pending !== null && toPathname(pending.href) === toPathname(location);
  if (pending !== null) {
    writePendingNavigation(null);
  }

  writeTrackedEntry(
    nextTrackedEntry(readTrackedEntry(), location, {
      replaced: pending?.type === "replace" && arrived,
      popped,
    }),
  );

  // 戻る・進む以外で着いた場合、戻る遷移の予約は古いものなので捨てる
  if (pending?.type !== "back" || !popped) {
    return;
  }
  if (arrived && !needsSearchReplace(pending.href, location)) {
    router.refresh();
  } else {
    // 追跡がずれて想定と違うページに戻ってしまった場合や、遷移先が表示条件（search）を
    // 指定していて戻った先と違う場合（保存した支出の月を表示するなど）は、本来の遷移先に置き換える
    writePendingNavigation({ type: "replace", href: pending.href });
    router.replace(pending.href);
  }
}

/**
 * アプリ内の遷移を追跡し、フォーム送信後に「直前の履歴エントリに戻る」か判断できるようにする。
 * あわせて、送信後に戻った先で最新の内容を取り直す（戻る遷移は Next.js やブラウザのキャッシュを表示するため）。
 * `useSearchParams` を使うため `Suspense` の内側に置くこと
 */
export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const poppedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const onPopState = () => {
      poppedRef.current = true;
    };
    // 別のドキュメントへ戻ってブラウザの bfcache から復元された場合は、
    // ページが描画し直されず位置の変化も検知できないため、ここで着いたときの処理を行う。
    // Next.js も pageshow でルーターの状態を復元するため、その後に取り直すよう後続のタスクに回す
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.setTimeout(() => handleArrival(router, true), 0);
      }
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  // search だけが変わる遷移（月の切り替えなど）でも戻る・進むの判定をやり直すため、searchParams にも依存する
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname と searchParams は位置が変わったことを検知するためだけに使う
  useEffect(() => {
    // 戻る・進むでは Next.js が popstate の処理中に戻り先を描画するため、この effect が
    // popstate のリスナーより先に実行されることがある。同じ履歴移動の popstate を拾ってから
    // 判断するよう、処理を後続のタスクに回す
    const timer = window.setTimeout(() => {
      // 初回は、ページの読み込みが戻る・進むによるものかで判断する
      const popped = poppedRef.current ?? isBackForwardLoad();
      poppedRef.current = false;
      handleArrival(router, popped);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, router]);

  return null;
}
