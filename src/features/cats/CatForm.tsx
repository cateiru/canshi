"use client";

import { useActionState } from "react";
import { Button, FormField } from "@/components/ui";
import type { Cat } from "@/db/schema";
import type { CatFormState } from "./actions";
import styles from "./CatForm.module.css";

type CatFormProps = {
  action: (state: CatFormState, formData: FormData) => Promise<CatFormState>;
  cat?: Cat;
  submitLabel: string;
};

const initialState: CatFormState = {};

const SEX_OPTIONS: { value: Cat["sex"]; label: string }[] = [
  { value: "female", label: "メス" },
  { value: "male", label: "オス" },
  { value: "unknown", label: "不明" },
];

export function CatForm({ action, cat, submitLabel }: CatFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="name"
        label="名前"
        defaultValue={cat?.name}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="sex">
          性別
        </label>
        <select
          id="sex"
          name="sex"
          defaultValue={cat?.sex ?? "unknown"}
          className={styles.select}
        >
          {SEX_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.sex ? (
          <span className={styles.errorMessage}>
            {state.fieldErrors.sex[0]}
          </span>
        ) : null}
      </div>

      <FormField
        name="birthDate"
        label="生年月日"
        type="date"
        defaultValue={cat?.birthDate ?? ""}
        errorMessage={state.fieldErrors?.birthDate?.[0]}
      />

      <FormField
        name="breed"
        label="猫種"
        defaultValue={cat?.breed ?? ""}
        errorMessage={state.fieldErrors?.breed?.[0]}
      />

      <FormField
        name="adoptedAt"
        label="お迎え日"
        type="date"
        defaultValue={cat?.adoptedAt ?? ""}
        errorMessage={state.fieldErrors?.adoptedAt?.[0]}
      />

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button type="submit" variant="primary" isDisabled={isPending}>
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
