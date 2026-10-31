"use client";

import { useState } from "react";
import { TbCheck } from "react-icons/tb";
import {
  Button,
  Checkbox,
  FormField,
  FormRow,
  Textarea,
} from "@/components/ui";
import type { MemoRecord } from "@/db/schema";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { MemoRecordFormState } from "./actions";
import styles from "./MemoRecordForm.module.css";

type MemoRecordFormProps = {
  action: (
    state: MemoRecordFormState,
    formData: FormData,
  ) => Promise<MemoRecordFormState>;
  memoRecord?: MemoRecord;
  submitLabel: string;
};

const initialState: MemoRecordFormState = {};

export function MemoRecordForm({
  action,
  memoRecord,
  submitLabel,
}: MemoRecordFormProps) {
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );
  const [now] = useState(() => new Date());
  // 追加するときは、ほかの記録と同じく今の日時を残す状態から始める
  const [hasDate, setHasDate] = useState(
    memoRecord ? memoRecord.recordedAt != null : true,
  );
  // 日付を残さないメモを編集して日付を残すときは、今の日時から始める
  const { date: defaultDate, time: defaultTime } = memoRecord?.recordedAt
    ? splitDateTimeUtc(memoRecord.recordedAt)
    : getLocalNowParts(now);

  return (
    <form action={formAction} className={styles.form}>
      <Textarea
        name="content"
        label="メモ"
        rows={6}
        defaultValue={memoRecord?.content ?? ""}
        errorMessage={state.fieldErrors?.content?.[0]}
        isRequired
      />

      <Checkbox name="hasDate" isSelected={hasDate} onChange={setHasDate}>
        日付を残す
      </Checkbox>

      {hasDate ? (
        <FormRow>
          <FormField
            name="recordedDate"
            label="日付"
            type="date"
            defaultValue={defaultDate}
            errorMessage={state.fieldErrors?.recordedDate?.[0]}
            isRequired
          />
          <FormField
            name="recordedTime"
            label="時刻"
            type="time"
            defaultValue={defaultTime}
            errorMessage={state.fieldErrors?.recordedTime?.[0]}
            isRequired
          />
        </FormRow>
      ) : (
        <p className={styles.note}>
          日付を残さないメモは、タイムラインには表示されません。
        </p>
      )}

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
