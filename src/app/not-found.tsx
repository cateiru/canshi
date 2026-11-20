import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";
import { ErrorView } from "@/features/shared/ErrorView/ErrorView";

export const metadata: Metadata = {
  title: "ページが見つかりません",
};

/** 存在しない URL と、`notFound()` を呼んだページ（見られない猫・記録など）で表示する */
export default function NotFound() {
  return (
    <ErrorView
      code="404"
      title="ページが見つかりません"
      description={
        <>URL が間違っているか、ページが移動・削除された可能性があります。</>
      }
      actions={
        <ButtonLink href="/" variant="primary">
          トップページへ戻る
        </ButtonLink>
      }
    />
  );
}
