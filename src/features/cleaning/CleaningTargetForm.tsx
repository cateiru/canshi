"use client";

import { useActionState } from "react";
import { Button, Checkbox, FormField } from "@/components/ui";
import type { CleaningTarget } from "@/db/schema";
import styles from "./CleaningTargetForm.module.css";
import type { CleaningTargetFormState } from "./targetActions";

type CleaningTargetFormProps = {
  action: (
    state: CleaningTargetFormState,
    formData: FormData,
  ) => Promise<CleaningTargetFormState>;
  cleaningTarget?: CleaningTarget;
  submitLabel: string;
};

const initialState: CleaningTargetFormState = {};

export function CleaningTargetForm({
  action,
  cleaningTarget,
  submitLabel,
}: CleaningTargetFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="name"
        label="名前"
        defaultValue={cleaningTarget?.name ?? ""}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />

      <FormField
        name="frequencyDays"
        label="頻度（日）"
        type="number"
        inputMode="numeric"
        defaultValue={cleaningTarget?.frequencyDays?.toString() ?? "7"}
        errorMessage={state.fieldErrors?.frequencyDays?.[0]}
        isRequired
      />

      <Checkbox
        name="isActive"
        defaultSelected={cleaningTarget?.isActive ?? true}
      >
        有効にする
      </Checkbox>

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button type="submit" variant="primary" isDisabled={isPending}>
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
