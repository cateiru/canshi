"use client";

import { ScaledIcon } from "@canshi/shared/ui/ScaledIcon";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useState,
} from "react";
import { TbEye, TbPlus } from "react-icons/tb";
import { Alert, Button, FormField, Select } from "@/components/ui";
import type { PermissionTree } from "@/features/external-access/domain/permissionRules";
import { PermissionTreeField } from "@/features/external-access/presentation/PermissionTreeField";
import { useNavigateAfterSubmit } from "@/features/navigation/useNavigateAfterSubmit";
import { Surface } from "@/features/shared/Surface";
import {
  API_TOKEN_EXPIRATIONS,
  type ApiTokenExpiration,
  DEFAULT_API_TOKEN_EXPIRATION,
} from "../domain/apiToken";
import { API_TOKEN_EXPIRATION_LABEL } from "../domain/labels";
import styles from "./ApiTokenForm.module.css";
import type { ApiTokenFormState } from "./actions";
import { IssuedApiTokenModal } from "./IssuedApiTokenModal";
import { API_TOKENS_PATH } from "./paths";

type ApiTokenFormProps = {
  action: (
    state: ApiTokenFormState,
    formData: FormData,
  ) => Promise<ApiTokenFormState>;
  tree: PermissionTree;
};

const initialState: ApiTokenFormState = {};

/**
 * API トークンを発行するフォーム。発行したトークンはダイアログに表示し、閉じるとトークンの一覧へ移る
 */
export function ApiTokenForm({ action, tree }: ApiTokenFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [expiration, setExpiration] = useState<ApiTokenExpiration>(
    DEFAULT_API_TOKEN_EXPIRATION,
  );
  const navigate = useNavigateAfterSubmit();
  // 家に所属していないと許可できるものが無く、`PermissionTreeField` は案内だけを表示して範囲を送らない
  const hasChoices =
    tree.households.length > 0 || tree.catalogOperations !== null;

  // `<form action>` で送ると、送信後の reset で許可する範囲のチェックが戻る。入力の間違いを
  // 直すときに選び直さずに済むよう、action を自分で呼ぶ（`PermissionsForm` と同じ、Issue #527）
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={styles.form}>
        {state.formError ? (
          <Alert color="error">{state.formError}</Alert>
        ) : null}
        <Surface gap="md">
          <FormField
            name="name"
            label="トークンの名前"
            placeholder="体重計との連携"
            description="何に使うトークンかを見分けるための名前です。このトークンで追加・編集した記録の履歴にも表示します。"
            errorMessage={state.fieldErrors?.name?.[0]}
            autoComplete="off"
            isRequired
          />
          <Select
            name="expiration"
            label="有効期限"
            options={API_TOKEN_EXPIRATIONS.map((value) => ({
              value,
              label: API_TOKEN_EXPIRATION_LABEL[value],
            }))}
            selectedKey={expiration}
            onSelectionChange={(key) =>
              setExpiration(key as ApiTokenExpiration)
            }
            errorMessage={state.fieldErrors?.expiration?.[0]}
          />
          {expiration === "none" ? (
            <Alert color="warning">
              期限なしのトークンは、削除するまで使い続けられます。トークンが漏れると、気づかないうちに使われ続けるおそれがあるため、できるだけ期限を設定してください。
            </Alert>
          ) : null}
        </Surface>
        <Surface
          title="許可する範囲"
          titleId="api-token-permissions"
          titleSize="lg"
          icon={<ScaledIcon icon={TbEye} aria-hidden="true" size={20} />}
          gap="sm"
        >
          <p className={styles.note}>
            チェックを入れた権限だけを、このトークンで使えます。あとから変更できます。
          </p>
          <PermissionTreeField
            tree={tree.households}
            catalogOperations={tree.catalogOperations}
            subject="このトークン"
          />
        </Surface>
        <div className={styles.footer}>
          <Button
            type="submit"
            variant="primary"
            leftIcon={TbPlus}
            isDisabled={!hasChoices || isPending || state.issued !== undefined}
          >
            {isPending ? "発行中..." : "トークンを発行する"}
          </Button>
        </div>
      </form>
      {state.issued ? (
        <IssuedApiTokenModal
          token={state.issued.token}
          expiresAt={
            state.issued.expiresAt ? new Date(state.issued.expiresAt) : null
          }
          onClose={() => navigate(API_TOKENS_PATH)}
        />
      ) : null}
    </>
  );
}
