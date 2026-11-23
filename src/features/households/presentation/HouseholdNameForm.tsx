"use client";

import { useActionState } from "react";
import { Alert, Button, FormField } from "@/components/ui";
import type { HouseholdNameFormState } from "./actions";
import styles from "./HouseholdNameForm.module.css";

type HouseholdNameFormProps = {
  action: (
    state: HouseholdNameFormState,
    formData: FormData,
  ) => Promise<HouseholdNameFormState>;
  defaultName: string;
};

const initialState: HouseholdNameFormState = {};

/**
 * 家の名前を変えるフォーム。入力欄と保存ボタンを 1 行に並べ、保存後も同じページにとどまり、
 * 結果をフォームの下に表示する。何を入力する欄かは「基本情報」の見出しと入力済みの名前で
 * 分かるため、ラベルは読み上げ用にだけ残す
 */
export function HouseholdNameForm({
  action,
  defaultName,
}: HouseholdNameFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}
      <div>
        <div className={styles.row}>
          <FormField
            name="name"
            label="家の名前"
            isLabelHidden
            defaultValue={defaultName}
            errorMessage={state.fieldErrors?.name?.[0]}
            isRequired
            className={styles.field}
          />
          <Button
            type="submit"
            variant="primary"
            isDisabled={isPending}
            className={styles.submit}
          >
            {isPending ? "保存中..." : "保存する"}
          </Button>
        </div>
        <p role="status" className={styles.message}>
          {isPending ? null : state.message}
        </p>
      </div>
    </form>
  );
}
