"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import { TbCheck } from "react-icons/tb";
import { Alert, addToast, Button } from "@/components/ui";
import type { PermissionTree } from "../domain/permissionRules";
import styles from "./PermissionsForm.module.css";
import { PermissionTreeField } from "./PermissionTreeField";

export type PermissionsFormState = {
  formError?: string;
};

type PermissionsFormProps = {
  action: (
    state: PermissionsFormState,
    formData: FormData,
  ) => Promise<PermissionsFormState>;
  tree: PermissionTree;
  /** 「このアプリ」のような、範囲を許可する相手の呼び方 */
  subject: string;
};

const initialState: PermissionsFormState = {};

/**
 * 設定の「AIとの接続」「APIトークン」で、外部接続から読み取れる範囲と書き込める範囲を選んで
 * 保存するフォーム
 */
export function PermissionsForm({
  action,
  tree,
  subject,
}: PermissionsFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (prevState: PermissionsFormState, formData: FormData) => {
      const result = await action(prevState, formData);
      if (!result.formError) {
        addToast({
          title: "許可する範囲を保存しました",
          color: "success",
        });
      }
      return result;
    },
    initialState,
  );

  // `<form action>` で送ると、React は送信後にフォームを reset する。react-aria の Checkbox は
  // reset でマウント時の値に戻そうとして onChange を呼ぶため、保存したチェックが
  // ページを開いたときの状態に戻って見える（Issue #527）。reset されないよう、送信は
  // onSubmit で受けて action を自分で呼ぶ
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <PermissionTreeField
        tree={tree.households}
        catalogOperations={tree.catalogOperations}
        subject={subject}
      />
      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}
      {tree.households.length > 0 || tree.catalogOperations !== null ? (
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            isDisabled={isPending}
            leftIcon={TbCheck}
          >
            {isPending ? "保存中..." : "保存する"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
