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
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { MemoRecordFormState } from "./actions";
import styles from "./MemoRecordForm.module.css";

type FormAction = (
  state: MemoRecordFormState,
  formData: FormData,
) => Promise<MemoRecordFormState>;

type MemoRecordFormProps = {
  catId: string;
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（記録 ID を除いて bind したもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: MemoRecordFormState,
    formData: FormData,
  ) => Promise<MemoRecordFormState>;
  memoRecord?: MemoRecord;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: MemoRecordFormState = {};

export function MemoRecordForm({
  catId,
  action,
  updateAction,
  memoRecord,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: MemoRecordFormProps) {
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
    media,
    redirectTo: `/cats/${catId}/memo-records`,
  });
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

      <MediaAttachmentField
        controller={media}
        label="画像"
        isDisabled={isPending}
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
