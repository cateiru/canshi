"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  FormField,
  Radio,
  RadioGroup,
  Textarea,
} from "@/components/ui";
import type { PoopRecord } from "@/db/schema";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { PoopRecordFormState } from "./actions";
import { POOP_RECORD_MEDIA_TYPE } from "./media";
import styles from "./PoopRecordForm.module.css";

type FormAction = (
  state: PoopRecordFormState,
  formData: FormData,
) => Promise<PoopRecordFormState>;

type PoopRecordFormProps = {
  catId: string;
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（記録 ID を除いて bind したもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: PoopRecordFormState,
    formData: FormData,
  ) => Promise<PoopRecordFormState>;
  poopRecord?: PoopRecord;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: PoopRecordFormState = {};

export function PoopRecordForm({
  catId,
  action,
  updateAction,
  poopRecord,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: PoopRecordFormProps) {
  const media = useMediaAttachments({
    initial: mediaAssets,
    limits: mediaLimits,
  });
  const [state, formAction, isPending] = useMediaFormAction({
    action,
    updateAction: updateAction
      ? (recordId) => updateAction.bind(null, recordId)
      : undefined,
    initialState,
    recordType: POOP_RECORD_MEDIA_TYPE,
    media,
    redirectTo: `/cats/${catId}/poop-records`,
  });
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = poopRecord?.occurredAt
    ? splitDateTimeUtc(poopRecord.occurredAt)
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

      <MediaAttachmentField
        controller={media}
        label="写真"
        isDisabled={isPending}
      />

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
