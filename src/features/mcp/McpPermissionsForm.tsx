"use client";

import { useActionState } from "react";
import { TbCheck, TbEye, TbPencil } from "react-icons/tb";
import { Alert, addToast, Button } from "@/components/ui";
import { Surface } from "@/features/shared/Surface";
import type { McpPermissionsFormState } from "./actions";
import { McpOperationsField } from "./McpOperationsField";
import styles from "./McpPermissionsForm.module.css";
import { McpPermissionTreeField } from "./McpPermissionTreeField";
import type {
  McpOperation,
  McpPermissionTreeHousehold,
} from "./permissionRules";

type McpPermissionsFormProps = {
  action: (
    state: McpPermissionsFormState,
    formData: FormData,
  ) => Promise<McpPermissionsFormState>;
  tree: McpPermissionTreeHousehold[];
  allowedOperations: McpOperation[];
};

const initialState: McpPermissionsFormState = {};

/**
 * 設定の「AIとの接続」で、AI から読み取れる範囲と、許可する操作を選んで保存するフォーム
 */
export function McpPermissionsForm({
  action,
  tree,
  allowedOperations,
}: McpPermissionsFormProps) {
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
      <Surface
        title="読み取りを許可する範囲"
        titleId="ai-permissions"
        titleSize="lg"
        icon={<TbEye aria-hidden="true" size={20} />}
        gap="sm"
      >
        <p className={styles.description}>
          チェックを外した家・猫・記録は、このアプリから読み取れなくなります。ほかのアプリとの接続には影響しません。
        </p>
        <p className={styles.description}>
          あとから登録した猫や、新しく参加した家は、読み取れる状態になります。
        </p>
        <McpPermissionTreeField tree={tree} />
      </Surface>
      <Surface
        title="許可する操作"
        titleId="ai-operations"
        titleSize="lg"
        icon={<TbPencil aria-hidden="true" size={20} />}
        gap="sm"
      >
        <p className={styles.description}>
          チェックした操作だけを、このアプリから行えます。記録・ごはん商品の削除はできません。
        </p>
        <McpOperationsField allowedOperations={allowedOperations} />
      </Surface>
      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}
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
    </form>
  );
}
