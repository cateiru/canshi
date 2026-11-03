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

/** 家の名前を変えるフォーム。保存後も同じページにとどまり、結果をフォームの下に表示する */
export function HouseholdNameForm({
  action,
  defaultName,
}: HouseholdNameFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}
      <FormField
        name="name"
        label="家の名前"
        defaultValue={defaultName}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />
      <div className={styles.footer}>
        <Button type="submit" variant="primary" isDisabled={isPending}>
          {isPending ? "保存中..." : "保存する"}
        </Button>
        <p role="status" className={styles.message}>
          {isPending ? null : state.message}
        </p>
      </div>
    </form>
  );
}
