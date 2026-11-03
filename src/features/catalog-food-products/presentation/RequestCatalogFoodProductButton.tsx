"use client";

import { useActionState } from "react";
import { TbSend } from "react-icons/tb";
import { Button } from "@/components/ui";
import type { RequestCatalogFoodProductState } from "./actions";
import styles from "./RequestCatalogFoodProductButton.module.css";

type RequestCatalogFoodProductButtonProps = {
  action: (
    state: RequestCatalogFoodProductState,
    formData: FormData,
  ) => Promise<RequestCatalogFoodProductState>;
  /** 検索条件（`toCatalogSearchQuery` で作った、検索ページの URL のクエリ） */
  searchQuery: string;
  /** 同じ検索条件で、対応を待っているリクエストがすでにあるか */
  isRequested: boolean;
};

/**
 * 共通のごはん商品の検索で見つからなかったときに、その検索条件で商品の追加をリクエストする
 * ボタン。リクエストした後（すでにリクエストしていたときも）は、ボタンの代わりに案内を表示する
 */
export function RequestCatalogFoodProductButton({
  action,
  searchQuery,
  isRequested,
}: RequestCatalogFoodProductButtonProps) {
  const [state, formAction, isPending] = useActionState(action, {
    isRequested,
  });

  if (state.isRequested) {
    return (
      <p role="status" className={styles.requested}>
        この条件でリクエスト済みです。共通のごはん商品に追加されたら、通知でお知らせします。
      </p>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <p>
        見つからない商品は、共通のごはん商品への追加をリクエストできます。追加されたら、通知でお知らせします。
      </p>
      <input type="hidden" name="searchQuery" value={searchQuery} />
      <Button
        type="submit"
        variant="secondary"
        leftIcon={TbSend}
        isDisabled={isPending}
      >
        {isPending ? "リクエスト中..." : "この条件でリクエストする"}
      </Button>
      {state.error ? (
        <p className={styles.errorMessage} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
