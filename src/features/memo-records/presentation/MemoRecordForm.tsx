"use client";

import { useState } from "react";
import { TbCheck } from "react-icons/tb";
import {
  Button,
  Checkbox,
  FormField,
  FormRow,
  TagInput,
  Textarea,
} from "@/components/ui";
import type { MemoRecord } from "@/db/schema";
import type { MediaLimits } from "@/features/media/domain/limits";
import type { MediaAssetView } from "@/features/media/domain/view";
import { MediaAttachmentField } from "@/features/media/presentation/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/presentation/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/presentation/useMediaFormAction";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import { MEMO_LABEL_NAME_MAX_LENGTH } from "../domain/labelSchema";
import type { MemoLabelView } from "../domain/memoLabel";
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
  /** 入力の候補にするラベル（猫の家のラベル） */
  householdLabels: MemoLabelView[];
  /** 編集するメモに付いているラベル */
  initialLabels?: MemoLabelView[];
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
  householdLabels,
  initialLabels = [],
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

  const [labelNames, setLabelNames] = useState<string[]>(() =>
    initialLabels.map(({ name }) => name),
  );
  const labelIdByName = new Map(
    [...householdLabels, ...initialLabels].map(({ id, name }) => [name, id]),
  );

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

      {/*
       * 付け外しは状態で持ち、hidden の input で送るため、フォームのリセットで消えない。
       * 開いている間にほかの画面で名前を変えられても元のラベルが付くよう、既存のラベルは ID も送る
       */}
      <TagInput
        label="ラベル"
        name="labels"
        getFormValue={(name) =>
          JSON.stringify({ id: labelIdByName.get(name) ?? null, name })
        }
        value={labelNames}
        onChange={setLabelNames}
        suggestions={householdLabels.map(({ name }) => name)}
        placeholder="入力して追加"
        maxLength={MEMO_LABEL_NAME_MAX_LENGTH}
        description="入力して Enter を押すか、候補から選ぶと追加できます。"
        errorMessage={state.fieldErrors?.labels?.[0]}
        isDisabled={isPending}
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
