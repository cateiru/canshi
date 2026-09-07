"use client";

import { useActionState, useState } from "react";
import { Button, Checkbox, FormField, Textarea } from "@/components/ui";
import type { MedicationDose } from "@/db/schema";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { MedicationDoseFormState } from "./doseActions";
import styles from "./MedicationDoseForm.module.css";

type MedicationDoseFormProps = {
  action: (
    state: MedicationDoseFormState,
    formData: FormData,
  ) => Promise<MedicationDoseFormState>;
  medicationDose?: MedicationDose;
  submitLabel: string;
};

const initialState: MedicationDoseFormState = {};

export function MedicationDoseForm({
  action,
  medicationDose,
  submitLabel,
}: MedicationDoseFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = medicationDose?.occurredAt
    ? splitDateTimeUtc(medicationDose.occurredAt)
    : getLocalNowParts(now);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <FormField
          name="occurredDate"
          label="投薬日"
          type="date"
          defaultValue={defaultDate}
          errorMessage={state.fieldErrors?.occurredDate?.[0]}
          isRequired
        />
        <FormField
          name="occurredTime"
          label="投薬時刻"
          type="time"
          defaultValue={defaultTime}
          errorMessage={state.fieldErrors?.occurredTime?.[0]}
          isRequired
        />
      </div>

      <Checkbox
        name="wasAdministered"
        defaultSelected={medicationDose?.wasAdministered ?? true}
      >
        投薬できた
      </Checkbox>

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={medicationDose?.memo ?? ""}
        errorMessage={state.fieldErrors?.memo?.[0]}
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
