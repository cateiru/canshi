import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { isDevPagesEnabled } from "@/features/auth/infrastructure/developmentLogin";

/**
 * 開発用のページ（`/dev/*`）の共通のレイアウト。`next dev` と Worker Previews でだけ表示し、
 * 本番では 404 にする（`isDevPagesEnabled`）。クライアントコンポーネントのページは実行時の
 * 環境変数を読めないため、ここでまとめて判定する
 */
export default function DevLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isDevPagesEnabled(env)) {
    notFound();
  }
  return children;
}
