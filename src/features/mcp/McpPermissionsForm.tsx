"use client";

import { useActionState } from "react";
import { TbCheck } from "react-icons/tb";
import { Alert, addToast, Button } from "@/components/ui";
import type { McpPermissionsFormState } from "./actions";
import styles from "./McpPermissionsForm.module.css";
import { McpPermissionTreeField } from "./McpPermissionTreeField";
import type { McpPermissionTreeHousehold } from "./permissionRules";

type McpPermissionsFormProps = {
  action: (
    state: McpPermissionsFormState,
    formData: FormData,
  ) => Promise<McpPermissionsFormState>;
  tree: McpPermissionTreeHousehold[];
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

  return (
    <form action={formAction} className={styles.form}>
      <McpPermissionTreeField tree={tree} />
      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}
      {tree.length > 0 ? (
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
