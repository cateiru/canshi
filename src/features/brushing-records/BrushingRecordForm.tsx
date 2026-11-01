"use client";

import { useState } from "react";
import { TbCheck } from "react-icons/tb";
import {
  Button,
  Checkbox,
  FormField,
  FormRow,
  Select,
  Textarea,
} from "@/components/ui";
import type { BrushingRecord } from "@/db/schema";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { BrushingRecordFormState } from "./actions";
import styles from "./BrushingRecordForm.module.css";
import { SHED_AMOUNT_LABEL } from "./labels";

type BrushingRecordFormProps = {
  action: (
    state: BrushingRecordFormState,
    formData: FormData,
  ) => Promise<BrushingRecordFormState>;
  brushingRecord?: BrushingRecord;
  submitLabel: string;
};

const initialState: BrushingRecordFormState = {};

const SHED_AMOUNT_OPTIONS = [
  { value: "", label: "未選択" },
  ...Object.entries(SHED_AMOUNT_LABEL).map(([value, label]) => ({
    value,
    label,
  })),
];

export function BrushingRecordForm({
  action,
  brushingRecord,
  submitLabel,
}: BrushingRecordFormProps) {
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = brushingRecord?.performedAt
    ? splitDateTimeUtc(brushingRecord.performedAt)
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

      <FormField
        name="durationMinutes"
        label="時間（分）"
        type="number"
        inputMode="numeric"
        defaultValue={brushingRecord?.durationMinutes?.toString() ?? ""}
        errorMessage={state.fieldErrors?.durationMinutes?.[0]}
      />

      <Select
        className={styles.select}
        name="shedAmount"
        label="抜け毛の量"
        defaultSelectedKey={brushingRecord?.shedAmount ?? ""}
        options={SHED_AMOUNT_OPTIONS}
        errorMessage={state.fieldErrors?.shedAmount?.[0]}
      />

      <Checkbox name="hasMats" defaultSelected={brushingRecord?.hasMats}>
        毛玉・もつれがあった
      </Checkbox>
      <Checkbox
        name="hasSkinIssue"
        defaultSelected={brushingRecord?.hasSkinIssue}
      >
        皮膚の異常（赤み・フケ・かさぶたなど）があった
      </Checkbox>

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={brushingRecord?.memo ?? ""}
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
