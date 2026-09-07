"use client";

import { useActionState, useState } from "react";
import { Button, FormField, Select, Textarea } from "@/components/ui";
import type { HospitalVisit, Symptom } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import type { HospitalVisitFormState } from "./actions";
import styles from "./HospitalVisitForm.module.css";

type HospitalVisitFormProps = {
  action: (
    state: HospitalVisitFormState,
    formData: FormData,
  ) => Promise<HospitalVisitFormState>;
  symptoms: Symptom[];
  hospitalVisit?: HospitalVisit;
  submitLabel: string;
};

const initialState: HospitalVisitFormState = {};

export function HospitalVisitForm({
  action,
  symptoms,
  hospitalVisit,
  submitLabel,
}: HospitalVisitFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  // 毎レンダリングで new Date() を評価すると FormField の defaultValue が
  // 再レンダリングのたびに変化し、ユーザーの入力が上書きされてしまうため、
  // マウント時に一度だけ計算して固定する
  const [now] = useState(() => new Date());
  const { date: defaultVisitedDate, time: defaultVisitedTime } =
    splitDateTimeUtc(hospitalVisit?.visitedAt ?? now);
  const defaultReserved = hospitalVisit?.reservedAt
    ? splitDateTimeUtc(hospitalVisit.reservedAt)
    : undefined;
  const defaultNextVisit = hospitalVisit?.nextVisitAt
    ? splitDateTimeUtc(hospitalVisit.nextVisitAt)
    : undefined;

  const symptomOptions = [
    { value: "", label: "関連付けない" },
    ...symptoms.map((symptom) => ({
      value: symptom.id,
      label: symptom.symptomType,
    })),
  ];

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <FormField
          name="reservedDate"
          label="予約日"
          type="date"
          defaultValue={defaultReserved?.date ?? ""}
          errorMessage={state.fieldErrors?.reservedDate?.[0]}
        />
        <FormField
          name="reservedTime"
          label="予約時刻"
          type="time"
          defaultValue={defaultReserved?.time ?? ""}
          errorMessage={state.fieldErrors?.reservedTime?.[0]}
        />
      </div>

      <div className={styles.row}>
        <FormField
          name="visitedDate"
          label="受診日"
          type="date"
          defaultValue={defaultVisitedDate}
          errorMessage={state.fieldErrors?.visitedDate?.[0]}
          isRequired
        />
        <FormField
          name="visitedTime"
          label="受診時刻"
          type="time"
          defaultValue={defaultVisitedTime}
          errorMessage={state.fieldErrors?.visitedTime?.[0]}
          isRequired
        />
      </div>

      <FormField
        name="reason"
        label="受診理由"
        defaultValue={hospitalVisit?.reason}
        errorMessage={state.fieldErrors?.reason?.[0]}
        isRequired
      />

      <Select
        name="symptomId"
        label="関連する症状"
        options={symptomOptions}
        defaultSelectedKey={hospitalVisit?.symptomId ?? ""}
        errorMessage={state.fieldErrors?.symptomId?.[0]}
      />

      <Textarea
        name="diagnosis"
        label="診断・所見"
        rows={3}
        defaultValue={hospitalVisit?.diagnosis ?? ""}
        errorMessage={state.fieldErrors?.diagnosis?.[0]}
      />

      <Textarea
        name="examinationResults"
        label="検査と結果"
        rows={3}
        defaultValue={hospitalVisit?.examinationResults ?? ""}
        errorMessage={state.fieldErrors?.examinationResults?.[0]}
      />

      <Textarea
        name="treatment"
        label="注射・処置"
        rows={3}
        defaultValue={hospitalVisit?.treatment ?? ""}
        errorMessage={state.fieldErrors?.treatment?.[0]}
      />

      <div className={styles.row}>
        <FormField
          name="nextVisitDate"
          label="次回受診予定日"
          type="date"
          defaultValue={defaultNextVisit?.date ?? ""}
          errorMessage={state.fieldErrors?.nextVisitDate?.[0]}
        />
        <FormField
          name="nextVisitTime"
          label="次回受診予定時刻"
          type="time"
          defaultValue={defaultNextVisit?.time ?? ""}
          errorMessage={state.fieldErrors?.nextVisitTime?.[0]}
        />
      </div>

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={hospitalVisit?.memo ?? ""}
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
