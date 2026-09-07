"use client";

import { useActionState, useState } from "react";
import { Button, FormField, Select, Textarea } from "@/components/ui";
import type { Symptom } from "@/db/schema";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { SymptomFormState } from "./actions";
import styles from "./SymptomForm.module.css";

type SymptomFormProps = {
  action: (
    state: SymptomFormState,
    formData: FormData,
  ) => Promise<SymptomFormState>;
  symptom?: Symptom;
  submitLabel: string;
};

const initialState: SymptomFormState = {};

const STATUS_OPTIONS = [
  { value: "ongoing", label: "継続中" },
  { value: "improving", label: "改善" },
  { value: "resolved", label: "解消" },
];

export function SymptomForm({
  action,
  symptom,
  submitLabel,
}: SymptomFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = symptom?.onsetAt
    ? splitDateTimeUtc(symptom.onsetAt)
    : getLocalNowParts(now);

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="symptomType"
        label="症状の種類"
        defaultValue={symptom?.symptomType}
        errorMessage={state.fieldErrors?.symptomType?.[0]}
        placeholder="嘔吐、下痢、元気消失 など"
        isRequired
      />

      <div className={styles.row}>
        <FormField
          name="onsetDate"
          label="発症日"
          type="date"
          defaultValue={defaultDate}
          errorMessage={state.fieldErrors?.onsetDate?.[0]}
          isRequired
        />
        <FormField
          name="onsetTime"
          label="発症時刻"
          type="time"
          defaultValue={defaultTime}
          errorMessage={state.fieldErrors?.onsetTime?.[0]}
          isRequired
        />
      </div>

      <FormField
        name="frequencyOrSeverity"
        label="回数・程度"
        defaultValue={symptom?.frequencyOrSeverity ?? ""}
        errorMessage={state.fieldErrors?.frequencyOrSeverity?.[0]}
        placeholder="1日3回、軽度 など"
      />

      <Select
        name="status"
        label="状態"
        options={STATUS_OPTIONS}
        defaultSelectedKey={symptom?.status ?? "ongoing"}
        errorMessage={state.fieldErrors?.status?.[0]}
      />

      <FormField
        name="appetiteNote"
        label="食欲メモ"
        defaultValue={symptom?.appetiteNote ?? ""}
        errorMessage={state.fieldErrors?.appetiteNote?.[0]}
      />

      <FormField
        name="energyNote"
        label="元気メモ"
        defaultValue={symptom?.energyNote ?? ""}
        errorMessage={state.fieldErrors?.energyNote?.[0]}
      />

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={symptom?.memo ?? ""}
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
