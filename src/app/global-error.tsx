"use client";

import { useEffect } from "react";
import { ServerErrorView } from "@/features/shared/ErrorView/ServerErrorView";
import "@/styles/globals.css";

/**
 * ルートレイアウトの表示中にエラーが起きたときに、ルートレイアウトの代わりに表示する。
 * 見た目設定（cookie）を読むルートレイアウトを通らないため、配色は端末の設定に合わせる（data-theme="system"）
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ja" data-theme="system">
      <body>
        <title>エラーが発生しました | CANSHI</title>
        <ServerErrorView error={error} retry={retry} />
      </body>
    </html>
  );
}
