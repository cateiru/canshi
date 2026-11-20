import type { Metadata } from "next";
import { ServerErrorPreview } from "./ServerErrorPreview";

export const metadata: Metadata = {
  title: "エラーページ",
};

/**
 * 予期しないエラーのページ（`src/app/error.tsx`）の見た目を確認する開発用ページ。
 * 本物のエラーを起こすと `next dev` ではエラーの表示（dev overlay）が重なるため、同じ中身を直接描く。
 * 本番では表示しない（`src/app/dev/layout.tsx`）
 */
export default function ErrorPageDevPage() {
  return <ServerErrorPreview />;
}
