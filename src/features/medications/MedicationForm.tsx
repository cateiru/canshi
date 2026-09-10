"use client";

import { Button, FormField, Select } from "@/components/ui";
import type { HospitalVisit, Medication, Symptom } from "@/db/schema";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import type { MedicationFormState } from "./actions";
import styles from "./MedicationForm.module.css";
import { MEDICATION_MEDIA_TYPE } from "./media";

type FormAction = (
  state: MedicationFormState,
  formData: FormData,
) => Promise<MedicationFormState>;

type MedicationFormProps = {
  catId: string;
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（記録 ID を除いて bind したもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: MedicationFormState,
    formData: FormData,
  ) => Promise<MedicationFormState>;
  symptoms: Symptom[];
  hospitalVisits: HospitalVisit[];
  medication?: Medication;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: MedicationFormState = {};

export function MedicationForm({
  catId,
  action,
  updateAction,
  symptoms,
  hospitalVisits,
  medication,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: MedicationFormProps) {
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
    recordType: MEDICATION_MEDIA_TYPE,
    media,
    redirectTo: `/cats/${catId}/medications`,
  });

  const symptomOptions = [
    { value: "", label: "関連付けない" },
    ...symptoms.map((symptom) => ({
      value: symptom.id,
      label: symptom.symptomType,
    })),
  ];

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
        name="name"
        label="薬名"
        defaultValue={medication?.name}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />

      <FormField
        name="doseAmount"
        label="1回量"
        defaultValue={medication?.doseAmount}
        errorMessage={state.fieldErrors?.doseAmount?.[0]}
        placeholder="1錠、0.5ml など"
        isRequired
      />

      <FormField
        name="dosesPerDay"
        label="1日あたりの回数"
        type="number"
        inputMode="numeric"
        defaultValue={medication?.dosesPerDay?.toString() ?? "1"}
        errorMessage={state.fieldErrors?.dosesPerDay?.[0]}
        isRequired
      />

      <div className={styles.row}>
        <FormField
          name="startDate"
          label="服用開始日"
          type="date"
          defaultValue={medication?.startDate}
          errorMessage={state.fieldErrors?.startDate?.[0]}
          isRequired
        />
        <FormField
          name="endDate"
          label="終了予定日"
          type="date"
          defaultValue={medication?.endDate ?? ""}
          errorMessage={state.fieldErrors?.endDate?.[0]}
        />
      </div>

      <Select
        name="symptomId"
        label="関連する症状"
        options={symptomOptions}
        defaultSelectedKey={medication?.symptomId ?? ""}
        errorMessage={state.fieldErrors?.symptomId?.[0]}
      />

      <Select
        name="hospitalVisitId"
        label="処方元の通院記録"
        options={hospitalVisitOptions}
        defaultSelectedKey={medication?.hospitalVisitId ?? ""}
        errorMessage={state.fieldErrors?.hospitalVisitId?.[0]}
      />

      <MediaAttachmentField
        controller={media}
        label="処方箋・薬袋の写真"
        isDisabled={isPending}
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
