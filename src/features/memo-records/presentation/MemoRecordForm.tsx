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
import type { MediaLimits } from "@/features/media/domain/limits";
import type { MediaAssetView } from "@/features/media/domain/view";
import { MediaAttachmentField } from "@/features/media/presentation/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/presentation/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/presentation/useMediaFormAction";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { MemoLabelFormInput } from "../domain/labelSchema";
import type { MemoLabelView } from "../domain/memoLabel";
import type { MemoRecordFormState } from "./actions";
import type { SaveMemoLabelActionResult } from "./labelActions";
import { MemoLabelFormModal } from "./MemoLabelFormModal";
import { MemoLabelsField } from "./MemoLabelsField";
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
  /** 選べるラベル（猫の家のラベル） */
  labels: MemoLabelView[];
  /** 編集するメモに付いているラベル */
  initialLabelIds?: string[];
  /** 猫の家に新しいラベルを追加する Action */
  createLabelAction: (
    input: MemoLabelFormInput,
  ) => Promise<SaveMemoLabelActionResult>;
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
  labels,
  initialLabelIds,
  createLabelAction,
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

  // このフォームから追加したラベルは、一覧を取り直さずに選択肢の最後に足す
  const [addedLabels, setAddedLabels] = useState<MemoLabelView[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<ReadonlySet<string>>(
    () => new Set(initialLabelIds),
  );
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const toggleLabel = (id: string, isSelected: boolean) =>
    setSelectedLabelIds((current) => {
      const next = new Set(current);
      if (isSelected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

  return (
    <>
      <form action={formAction} className={styles.form}>
        <Textarea
          name="content"
          label="メモ"
          rows={6}
          defaultValue={memoRecord?.content ?? ""}
          errorMessage={state.fieldErrors?.content?.[0]}
          isRequired
        />

        <MemoLabelsField
          labels={[...labels, ...addedLabels]}
          selectedIds={selectedLabelIds}
          onToggle={toggleLabel}
          onAdd={() => setIsAddingLabel(true)}
          isDisabled={isPending}
          errorMessage={state.fieldErrors?.labelIds?.[0]}
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

      {/* フォームが入れ子にならないよう、メモのフォームの外に置く */}
      <MemoLabelFormModal
        open={isAddingLabel}
        action={createLabelAction}
        onSaved={(label) => {
          setIsAddingLabel(false);
          setAddedLabels((current) => [...current, label]);
          toggleLabel(label.id, true);
        }}
        onClose={() => setIsAddingLabel(false)}
      />
    </>
  );
}
