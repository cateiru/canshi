"use client";

import { ServerErrorView } from "@/features/shared/ErrorView/ServerErrorView";

/** VRT で毎回同じ表示になるよう、エラー ID を固定したサーバーのエラー */
const previewError = Object.assign(new Error("preview"), {
  digest: "1234567890",
});

/** 予期しないエラーのページ（`src/app/error.tsx`）と同じ中身を、エラーを起こさずに表示する */
export function ServerErrorPreview() {
  return <ServerErrorView error={previewError} retry={() => {}} />;
}
