"use client";

import { useEffect } from "react";
import { ServerErrorView } from "@/features/shared/ErrorView/ServerErrorView";

/**
 * ページの表示中に予期しないエラーが起きたときに表示する。ルートレイアウト（ヘッダー・フッター）は残し、
 * その中身だけを差し替える。ルートレイアウト自体のエラーは `global-error.tsx` が受け持つ
 */
export default function ErrorPage({
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
    <>
      <title>エラーが発生しました | CANSHI</title>
      <ServerErrorView error={error} retry={retry} />
    </>
  );
}
