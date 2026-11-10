"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import { TbCheck } from "react-icons/tb";
import { Alert, addToast, Button } from "@/components/ui";
import type { McpPermissionTree } from "../domain/permissionRules";
import type { McpPermissionsFormState } from "./actions";
import styles from "./McpPermissionsForm.module.css";
import { McpPermissionTreeField } from "./McpPermissionTreeField";

type McpPermissionsFormProps = {
  action: (
    state: McpPermissionsFormState,
    formData: FormData,
  ) => Promise<McpPermissionsFormState>;
  tree: McpPermissionTree;
};

const initialState: McpPermissionsFormState = {};

/** 設定の「AIとの接続」で、AI から読み取れる範囲と書き込める範囲を選んで保存するフォーム */
export function McpPermissionsForm({ action, tree }: McpPermissionsFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (prevState: McpPermissionsFormState, formData: FormData) => {
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
      <McpPermissionTreeField
        tree={tree.households}
        catalogOperations={tree.catalogOperations}
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
