"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markNotificationsReadAction } from "./actions";

type MarkNotificationsReadProps = {
  ids: string[];
};

/**
 * 通知センターの表示後（マウント後）に、表示中の未読の通知をまとめて既読にする。
 * Server Component のレンダー中に既読化すると、プリフェッチ・再試行・中断された遷移でも
 * 実行されてしまい、「画面を表示した」というユーザー操作より前に状態が変わってしまう
 * （https://nextjs.org/docs/app/guides/prefetching）。
 * 完了後は `router.refresh()` でヘッダーの `NotificationBadge` を含めて表示を更新する
 */
export function MarkNotificationsRead({ ids }: MarkNotificationsReadProps) {
  const router = useRouter();
  const calledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }
    const key = ids.join(",");
    if (calledKeyRef.current === key) {
      return;
    }
    calledKeyRef.current = key;

    markNotificationsReadAction(ids).then(() => {
      router.refresh();
    });
  }, [ids, router]);

  return null;
}
