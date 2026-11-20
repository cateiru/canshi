"use client";

import { Button } from "@/components/ui";
import { getButtonClassName } from "@/components/ui/Button/buttonStyles";
import { ErrorView } from "./ErrorView";

type ServerErrorViewProps = {
  error: unknown;
  /** エラーになった部分を取得し直して表示し直す（Next.js の error.tsx の `retry`） */
  retry: () => void;
};

/** サーバーの Error に付く、ログと照合するための ID（`digest`）を取り出す */
function errorDigest(error: unknown) {
  if (error instanceof Error && "digest" in error) {
    const { digest } = error as Error & { digest?: unknown };
    return typeof digest === "string" ? digest : undefined;
  }
  return undefined;
}

/**
 * 404 以外の予期しないエラーで表示する中身（`src/app/error.tsx`・`global-error.tsx`）。
 * どの画面で起きたかによらず、再読み込みとトップページへの導線を出す
 */
export function ServerErrorView({ error, retry }: ServerErrorViewProps) {
  return (
    <ErrorView
      code="500"
      title="エラーが発生しました"
      description={
        <>
          ページを表示できませんでした。
          <br />
          時間をおいて、もう一度お試しください。
        </>
      }
      errorId={errorDigest(error)}
      actions={
        <>
          <Button variant="primary" onPress={retry}>
            もう一度読み込む
          </Button>
          {/* ルートレイアウトの外（global-error）でも使うため、next/link ではなく通常のリンクで移動し直す */}
          <a href="/" className={getButtonClassName("secondary")}>
            トップページへ戻る
          </a>
        </>
      }
    />
  );
}
