"use client";

import { useState } from "react";
import { Button, Checkbox, FormField, Textarea } from "@/components/ui";
import type { VomitRecord } from "@/db/schema";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { VomitRecordFormState } from "./actions";
import { VOMIT_RECORD_MEDIA_TYPE } from "./media";
import styles from "./VomitRecordForm.module.css";

type FormAction = (
  state: VomitRecordFormState,
  formData: FormData,
) => Promise<VomitRecordFormState>;

type VomitRecordFormProps = {
  catId: string;
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（記録 ID を除いて bind したもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: VomitRecordFormState,
    formData: FormData,
  ) => Promise<VomitRecordFormState>;
  vomitRecord?: VomitRecord;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: VomitRecordFormState = {};

export function VomitRecordForm({
  catId,
  action,
  updateAction,
  vomitRecord,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: VomitRecordFormProps) {
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
    recordType: VOMIT_RECORD_MEDIA_TYPE,
    media,
    redirectTo: `/cats/${catId}/vomit-records`,
  });
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = vomitRecord?.occurredAt
    ? splitDateTimeUtc(vomitRecord.occurredAt)
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

      <FormField
        name="amount"
        label="量"
        defaultValue={vomitRecord?.amount ?? ""}
        errorMessage={state.fieldErrors?.amount?.[0]}
        placeholder="少なめ／ふつう／多め など"
      />

      <FormField
        name="color"
        label="色"
        defaultValue={vomitRecord?.color ?? ""}
        errorMessage={state.fieldErrors?.color?.[0]}
      />

      <Checkbox name="hasBlood" defaultSelected={vomitRecord?.hasBlood}>
        血液が混じっていた
      </Checkbox>
      <Checkbox
        name="hasForeignObject"
        defaultSelected={vomitRecord?.hasForeignObject}
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
        defaultValue={vomitRecord?.appetiteNote ?? ""}
        errorMessage={state.fieldErrors?.appetiteNote?.[0]}
      />

      <FormField
        name="energyNote"
        label="元気メモ"
        defaultValue={vomitRecord?.energyNote ?? ""}
        errorMessage={state.fieldErrors?.energyNote?.[0]}
      />

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={vomitRecord?.memo ?? ""}
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
