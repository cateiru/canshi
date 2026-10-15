"use client";

import type { MouseEvent, ReactNode } from "react";
import { markReplaceNavigation, toPathname } from "./history";

/** 新しいタブで開くなど、このページで移動しないクリックか */
function opensElsewhere(event: MouseEvent) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * 中のリンク（`replace` を指定した `Link`・NavCard・ButtonLink・パンくず）で今の履歴エントリを置き換えて
 * 移動することを、`NavigationTracker` に伝える。`href` と同じページへのリンクを押したときだけ伝えるため、
 * ほかのリンクを含むまとまり（パンくずなど）をまとめて包んでもよい。移動元のページを履歴にも、送信後の遷移の判断
 * （`useNavigateAfterSubmit`）にも残さない。
 * アイコンなどのコンポーネントを受け取るリンクを Server Component のまま描画できるよう、
 * リンク自体は包まず、クリックだけを受け取る（レイアウトに影響しないよう `display: contents`）
 */
export function ReplaceNavigation({
  href,
  children,
}: {
  /** 置き換えて移動するリンクの移動先 */
  href: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ display: "contents" }}
      onClickCapture={(event) => {
        const link =
          event.target instanceof Element ? event.target.closest("a") : null;
        const linkHref = link?.getAttribute("href");
        if (
          !opensElsewhere(event) &&
          linkHref &&
          toPathname(linkHref) === toPathname(href)
        ) {
          markReplaceNavigation(href);
        }
      }}
    >
      {children}
    </div>
  );
}
