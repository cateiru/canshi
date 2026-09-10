"use client";

import { useState } from "react";
import { Button, FormField, Select, Textarea } from "@/components/ui";
import type { HospitalVisit, Symptom } from "@/db/schema";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { SymptomFormState } from "./actions";
import { SYMPTOM_MEDIA_TYPE } from "./media";
import styles from "./SymptomForm.module.css";

type FormAction = (
  state: SymptomFormState,
  formData: FormData,
) => Promise<SymptomFormState>;

type SymptomFormProps = {
  catId: string;
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（記録 ID を除いて bind したもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: SymptomFormState,
    formData: FormData,
  ) => Promise<SymptomFormState>;
  hospitalVisits: HospitalVisit[];
  symptom?: Symptom;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: SymptomFormState = {};

const STATUS_OPTIONS = [
  { value: "ongoing", label: "継続中" },
  { value: "improving", label: "改善" },
  { value: "resolved", label: "解消" },
];

export function SymptomForm({
  catId,
  action,
  updateAction,
  hospitalVisits,
  symptom,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: SymptomFormProps) {
  const media = useMediaAttachments({
    initial: mediaAssets,
    limits: mediaLimits,
    allowVideo: true,
  });
  const [state, formAction, isPending] = useMediaFormAction({
    action,
    updateAction: updateAction
      ? (recordId) => updateAction.bind(null, recordId)
      : undefined,
    initialState,
    recordType: SYMPTOM_MEDIA_TYPE,
    media,
    redirectTo: `/cats/${catId}/symptoms`,
  });
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = symptom?.onsetAt
    ? splitDateTimeUtc(symptom.onsetAt)
    : getLocalNowParts(now);

  const hospitalVisitOptions = [
    { value: "", label: "関連付けない" },
    ...hospitalVisits.map((hospitalVisit) => ({
      value: hospitalVisit.id,
      label: hospitalVisitOptionLabel(hospitalVisit),
    })),
  ];

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

      <Select
        name="hospitalVisitId"
        label="関連する通院記録"
        options={hospitalVisitOptions}
        defaultSelectedKey={symptom?.hospitalVisitId ?? ""}
        errorMessage={state.fieldErrors?.hospitalVisitId?.[0]}
      />

      <MediaAttachmentField
        controller={media}
        label="写真・動画"
        allowVideo
        description="動画は位置情報などのメタデータが残る場合があります（写真は自動で取り除きます）"
        isDisabled={isPending}
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
