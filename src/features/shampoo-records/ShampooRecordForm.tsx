"use client";

import { useState } from "react";
import { TbCheck } from "react-icons/tb";
import { Button, FormField, FormRow, Textarea } from "@/components/ui";
import type { ShampooRecord } from "@/db/schema";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { ShampooRecordFormState } from "./actions";
import styles from "./ShampooRecordForm.module.css";

type ShampooRecordFormProps = {
  action: (
    state: ShampooRecordFormState,
    formData: FormData,
  ) => Promise<ShampooRecordFormState>;
  shampooRecord?: ShampooRecord;
  submitLabel: string;
};

const initialState: ShampooRecordFormState = {};

export function ShampooRecordForm({
  action,
  shampooRecord,
  submitLabel,
}: ShampooRecordFormProps) {
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = shampooRecord?.performedAt
    ? splitDateTimeUtc(shampooRecord.performedAt)
    : getLocalNowParts(now);

  return (
    <form action={formAction} className={styles.form}>
      <FormRow>
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
      </FormRow>

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={shampooRecord?.memo ?? ""}
        errorMessage={state.fieldErrors?.memo?.[0]}
      />

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        isDisabled={isPending}
        leftIcon={TbCheck}
      >
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
