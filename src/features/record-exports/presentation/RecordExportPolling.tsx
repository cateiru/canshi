"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { recordExportStatusApiPath } from "./paths";

/** 処理中の出力の状態を確かめる間隔（ミリ秒） */
export const RECORD_EXPORT_POLLING_INTERVAL_MS = 1000;

type RecordExportPollingProps = {
  householdId: string;
};

/**
 * 出力のページで、家に処理中の出力がある間だけ置く。1 秒ごとに状態を確かめ、処理中の出力が
 * なくなったら（完了・失敗したら）ページを取り直して、一覧とフォームを表示し直す。
 * 前の確認の応答を待ってから次を予約し、確認が重ならないようにする
 */
export function RecordExportPolling({ householdId }: RecordExportPollingProps) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const check = async () => {
      try {
        const response = await fetch(recordExportStatusApiPath(householdId), {
          cache: "no-store",
        });
        if (stopped) {
          return;
        }
        if (response.ok) {
          const { running } = (await response.json()) as { running: boolean };
          if (stopped) {
            return;
          }
          if (!running) {
            router.refresh();
            return;
          }
        } else if (response.status < 500) {
          // ログインが切れた・家から外れたときは、確認をやめてページを取り直す（ログイン画面などへ移る）
          router.refresh();
          return;
        }
      } catch {
        // 通信できないときは、次の確認でやり直す
      }
      if (!stopped) {
        timer = setTimeout(check, RECORD_EXPORT_POLLING_INTERVAL_MS);
      }
    };

    timer = setTimeout(check, RECORD_EXPORT_POLLING_INTERVAL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [householdId, router]);

  return null;
}
