"use client";

import { useActionState } from "react";
import { Button, FormField, Select } from "@/components/ui";
import type { Medication, Symptom } from "@/db/schema";
import type { MedicationFormState } from "./actions";
import styles from "./MedicationForm.module.css";

type MedicationFormProps = {
  action: (
    state: MedicationFormState,
    formData: FormData,
  ) => Promise<MedicationFormState>;
  symptoms: Symptom[];
  medication?: Medication;
  submitLabel: string;
};

const initialState: MedicationFormState = {};

export function MedicationForm({
  action,
  symptoms,
  medication,
  submitLabel,
}: MedicationFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const symptomOptions = [
    { value: "", label: "関連付けない" },
    ...symptoms.map((symptom) => ({
      value: symptom.id,
      label: symptom.symptomType,
    })),
  ];

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="name"
        label="薬名"
        defaultValue={medication?.name}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />

      <FormField
        name="doseAmount"
        label="1回量"
        defaultValue={medication?.doseAmount}
        errorMessage={state.fieldErrors?.doseAmount?.[0]}
        placeholder="1錠、0.5ml など"
        isRequired
      />

      <FormField
        name="dosesPerDay"
        label="1日あたりの回数"
        type="number"
        inputMode="numeric"
        defaultValue={medication?.dosesPerDay?.toString() ?? "1"}
        errorMessage={state.fieldErrors?.dosesPerDay?.[0]}
        isRequired
      />

      <div className={styles.row}>
        <FormField
          name="startDate"
          label="服用開始日"
          type="date"
          defaultValue={medication?.startDate}
          errorMessage={state.fieldErrors?.startDate?.[0]}
          isRequired
        />
        <FormField
          name="endDate"
          label="終了予定日"
          type="date"
          defaultValue={medication?.endDate ?? ""}
          errorMessage={state.fieldErrors?.endDate?.[0]}
        />
      </div>

      <Select
        name="symptomId"
        label="関連する症状"
        options={symptomOptions}
        defaultSelectedKey={medication?.symptomId ?? ""}
        errorMessage={state.fieldErrors?.symptomId?.[0]}
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
