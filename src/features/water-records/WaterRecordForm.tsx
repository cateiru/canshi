"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Radio,
  RadioGroup,
  Select,
  Textarea,
} from "@/components/ui";
import type { WaterRecord } from "@/db/schema";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { WaterRecordFormState } from "./actions";
import styles from "./WaterRecordForm.module.css";

type WaterRecordFormProps = {
  action: (
    state: WaterRecordFormState,
    formData: FormData,
  ) => Promise<WaterRecordFormState>;
  waterRecord?: WaterRecord;
  submitLabel: string;
};

const initialState: WaterRecordFormState = {};

const SUBJECTIVE_AMOUNT_OPTIONS = [
  { value: "", label: "未選択" },
  { value: "more", label: "多い" },
  { value: "usual", label: "いつも通り" },
  { value: "less", label: "少ない" },
];

export function WaterRecordForm({
  action,
  waterRecord,
  submitLabel,
}: WaterRecordFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = waterRecord?.occurredAt
    ? splitDateTimeUtc(waterRecord.occurredAt)
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
        name="measurementMethod"
        label="測定方法"
        defaultValue={waterRecord?.measurementMethod ?? "measuring_cup"}
      >
        <Radio value="measuring_cup">計量カップ</Radio>
        <Radio value="scale">秤</Radio>
        <Radio value="visual">目視</Radio>
      </RadioGroup>
      {state.fieldErrors?.measurementMethod ? (
        <span className={styles.errorMessage}>
          {state.fieldErrors.measurementMethod[0]}
        </span>
      ) : null}

      <div className={styles.row}>
        <FormField
          name="suppliedAmountMl"
          label="給水量（ml）"
          type="number"
          inputMode="decimal"
          defaultValue={waterRecord?.suppliedAmountMl?.toString()}
          errorMessage={state.fieldErrors?.suppliedAmountMl?.[0]}
          isRequired
        />
        <FormField
          name="remainingAmountMl"
          label="残量（ml）"
          type="number"
          inputMode="decimal"
          defaultValue={waterRecord?.remainingAmountMl?.toString() ?? ""}
          errorMessage={state.fieldErrors?.remainingAmountMl?.[0]}
        />
      </div>

      <Checkbox name="hasSpill" defaultSelected={waterRecord?.hasSpill}>
        こぼれがあった
      </Checkbox>
      <Checkbox
        name="wasWaterChanged"
        defaultSelected={waterRecord?.wasWaterChanged}
      >
        水を交換した
      </Checkbox>

      <Select
        name="subjectiveAmount"
        label="主観評価"
        defaultSelectedKey={waterRecord?.subjectiveAmount ?? ""}
        options={SUBJECTIVE_AMOUNT_OPTIONS}
        errorMessage={state.fieldErrors?.subjectiveAmount?.[0]}
      />

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={waterRecord?.memo ?? ""}
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
