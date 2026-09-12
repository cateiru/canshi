"use client";

import { useActionState, useState } from "react";
import { TbCheck } from "react-icons/tb";
import { Button, FormField, Textarea } from "@/components/ui";
import type { CleaningRecord } from "@/db/schema";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import styles from "./CleaningRecordForm.module.css";
import type { CleaningRecordFormState } from "./recordActions";

type CleaningRecordFormProps = {
  action: (
    state: CleaningRecordFormState,
    formData: FormData,
  ) => Promise<CleaningRecordFormState>;
  cleaningRecord?: CleaningRecord;
  submitLabel: string;
};

const initialState: CleaningRecordFormState = {};

export function CleaningRecordForm({
  action,
  cleaningRecord,
  submitLabel,
}: CleaningRecordFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = cleaningRecord?.performedAt
    ? splitDateTimeUtc(cleaningRecord.performedAt)
    : getLocalNowParts(now);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <FormField
          name="performedDate"
          label="実施日"
          type="date"
          defaultValue={defaultDate}
          errorMessage={state.fieldErrors?.performedDate?.[0]}
          isRequired
        />
        <FormField
          name="performedTime"
          label="実施時刻"
          type="time"
          defaultValue={defaultTime}
          errorMessage={state.fieldErrors?.performedTime?.[0]}
          isRequired
        />
      </div>

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={cleaningRecord?.memo ?? ""}
        errorMessage={state.fieldErrors?.memo?.[0]}
      />

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        className={styles.submitButton}
        isDisabled={isPending}
      >
        <TbCheck aria-hidden="true" size={18} />
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
