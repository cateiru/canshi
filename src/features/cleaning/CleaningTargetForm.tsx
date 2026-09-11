"use client";

import { useActionState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Radio,
  RadioGroup,
} from "@/components/ui";
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
        name="frequencyValue"
        label="頻度"
        type="number"
        inputMode="numeric"
        defaultValue={cleaningTarget?.frequencyValue?.toString() ?? "7"}
        errorMessage={state.fieldErrors?.frequencyValue?.[0]}
        isRequired
      />

      <RadioGroup
        name="frequencyUnit"
        label="頻度の単位"
        defaultValue={cleaningTarget?.frequencyUnit ?? "days"}
      >
        <Radio value="days">日</Radio>
        <Radio value="months">ヶ月</Radio>
      </RadioGroup>
      {state.fieldErrors?.frequencyUnit ? (
        <span className={styles.errorMessage}>
          {state.fieldErrors.frequencyUnit[0]}
        </span>
      ) : null}

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
