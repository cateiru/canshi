"use client";

import { useActionState, useState } from "react";
import { TbCheck } from "react-icons/tb";
import { Button, FormField, Radio, RadioGroup } from "@/components/ui";
import type { WeightRecord } from "@/db/schema";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { WeightRecordFormState } from "./actions";
import styles from "./WeightRecordForm.module.css";

type WeightRecordFormProps = {
  action: (
    state: WeightRecordFormState,
    formData: FormData,
  ) => Promise<WeightRecordFormState>;
  weightRecord?: WeightRecord;
  submitLabel: string;
};

const initialState: WeightRecordFormState = {};

export function WeightRecordForm({
  action,
  weightRecord,
  submitLabel,
}: WeightRecordFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [inputMethod, setInputMethod] = useState<"auto" | "direct">(
    weightRecord?.inputMethod ?? "auto",
  );
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = weightRecord?.occurredAt
    ? splitDateTimeUtc(weightRecord.occurredAt)
    : getLocalNowParts(now);

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

      <RadioGroup
        name="inputMethod"
        label="入力方法"
        value={inputMethod}
        onChange={(value) => setInputMethod(value as "auto" | "direct")}
      >
        <Radio value="auto">人間込みの体重から自動算出</Radio>
        <Radio value="direct">猫の体重を直接入力</Radio>
      </RadioGroup>

      {inputMethod === "auto" ? (
        <>
          <FormField
            name="combinedWeightKg"
            label="人間を含んだ体重（kg）"
            type="number"
            inputMode="decimal"
            defaultValue={weightRecord?.combinedWeightKg?.toString()}
            errorMessage={state.fieldErrors?.combinedWeightKg?.[0]}
            isRequired
          />
          <FormField
            name="humanWeightKg"
            label="人間だけの体重（kg）"
            type="number"
            inputMode="decimal"
            defaultValue={weightRecord?.humanWeightKg?.toString()}
            errorMessage={state.fieldErrors?.humanWeightKg?.[0]}
            isRequired
          />
        </>
      ) : (
        <FormField
          name="catWeightKg"
          label="猫の体重（kg）"
          type="number"
          inputMode="decimal"
          defaultValue={weightRecord?.catWeightKg?.toString()}
          errorMessage={state.fieldErrors?.catWeightKg?.[0]}
          isRequired
        />
      )}

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
