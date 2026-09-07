"use client";

import { useActionState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Radio,
  RadioGroup,
  Textarea,
} from "@/components/ui";
import type { PoopRecord } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import type { PoopRecordFormState } from "./actions";
import styles from "./PoopRecordForm.module.css";

type PoopRecordFormProps = {
  action: (
    state: PoopRecordFormState,
    formData: FormData,
  ) => Promise<PoopRecordFormState>;
  poopRecord?: PoopRecord;
  submitLabel: string;
};

const initialState: PoopRecordFormState = {};

export function PoopRecordForm({
  action,
  poopRecord,
  submitLabel,
}: PoopRecordFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { date: defaultDate, time: defaultTime } = splitDateTimeUtc(
    poopRecord?.occurredAt ?? new Date(),
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
        defaultValue={poopRecord?.count?.toString() ?? "1"}
        errorMessage={state.fieldErrors?.count?.[0]}
        isRequired
      />

      <RadioGroup
        name="consistency"
        label="状態"
        defaultValue={poopRecord?.consistency ?? "normal"}
      >
        <Radio value="hard">硬い</Radio>
        <Radio value="normal">ふつう</Radio>
        <Radio value="soft">柔らかい</Radio>
        <Radio value="liquid">液体</Radio>
      </RadioGroup>
      {state.fieldErrors?.consistency ? (
        <span className={styles.errorMessage}>
          {state.fieldErrors.consistency[0]}
        </span>
      ) : null}

      <FormField
        name="amount"
        label="量"
        defaultValue={poopRecord?.amount ?? ""}
        errorMessage={state.fieldErrors?.amount?.[0]}
        placeholder="少なめ／ふつう／多め など"
      />

      <FormField
        name="color"
        label="色"
        defaultValue={poopRecord?.color ?? ""}
        errorMessage={state.fieldErrors?.color?.[0]}
      />

      <Checkbox name="hasBlood" defaultSelected={poopRecord?.hasBlood}>
        血液が混じっていた
      </Checkbox>
      <Checkbox
        name="hasForeignObject"
        defaultSelected={poopRecord?.hasForeignObject}
      >
        異物が混じっていた
      </Checkbox>

      <FormField
        name="appetiteNote"
        label="食欲メモ"
        defaultValue={poopRecord?.appetiteNote ?? ""}
        errorMessage={state.fieldErrors?.appetiteNote?.[0]}
      />

      <FormField
        name="energyNote"
        label="元気メモ"
        defaultValue={poopRecord?.energyNote ?? ""}
        errorMessage={state.fieldErrors?.energyNote?.[0]}
      />

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={poopRecord?.memo ?? ""}
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
