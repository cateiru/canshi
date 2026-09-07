"use client";

import { useActionState } from "react";
import { Button, Checkbox, FormField, Textarea } from "@/components/ui";
import type { VomitRecord } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import type { VomitRecordFormState } from "./actions";
import styles from "./VomitRecordForm.module.css";

type VomitRecordFormProps = {
  action: (
    state: VomitRecordFormState,
    formData: FormData,
  ) => Promise<VomitRecordFormState>;
  vomitRecord?: VomitRecord;
  submitLabel: string;
};

const initialState: VomitRecordFormState = {};

export function VomitRecordForm({
  action,
  vomitRecord,
  submitLabel,
}: VomitRecordFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { date: defaultDate, time: defaultTime } = splitDateTimeUtc(
    vomitRecord?.occurredAt ?? new Date(),
  );

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <FormField
          name="occurredDate"
          label="発生日"
          type="date"
          defaultValue={defaultDate}
          errorMessage={state.fieldErrors?.occurredDate?.[0]}
          isRequired
        />
        <FormField
          name="occurredTime"
          label="発生時刻"
          type="time"
          defaultValue={defaultTime}
          errorMessage={state.fieldErrors?.occurredTime?.[0]}
          isRequired
        />
      </div>

      <FormField
        name="count"
        label="回数"
        type="number"
        inputMode="numeric"
        defaultValue={vomitRecord?.count?.toString() ?? "1"}
        errorMessage={state.fieldErrors?.count?.[0]}
        isRequired
      />

      <FormField
        name="amount"
        label="量"
        defaultValue={vomitRecord?.amount ?? ""}
        errorMessage={state.fieldErrors?.amount?.[0]}
        placeholder="少なめ／ふつう／多め など"
      />

      <FormField
        name="color"
        label="色"
        defaultValue={vomitRecord?.color ?? ""}
        errorMessage={state.fieldErrors?.color?.[0]}
      />

      <Checkbox name="hasBlood" defaultSelected={vomitRecord?.hasBlood}>
        血液が混じっていた
      </Checkbox>
      <Checkbox
        name="hasForeignObject"
        defaultSelected={vomitRecord?.hasForeignObject}
      >
        異物が混じっていた
      </Checkbox>

      <FormField
        name="appetiteNote"
        label="食欲メモ"
        defaultValue={vomitRecord?.appetiteNote ?? ""}
        errorMessage={state.fieldErrors?.appetiteNote?.[0]}
      />

      <FormField
        name="energyNote"
        label="元気メモ"
        defaultValue={vomitRecord?.energyNote ?? ""}
        errorMessage={state.fieldErrors?.energyNote?.[0]}
      />

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={vomitRecord?.memo ?? ""}
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
