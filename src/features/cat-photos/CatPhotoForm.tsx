"use client";

import { useState } from "react";
import { Button, FormField, Textarea } from "@/components/ui";
import type { CatPhoto } from "@/db/schema";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { CatPhotoFormState } from "./actions";
import styles from "./CatPhotoForm.module.css";
import { CAT_PHOTO_MEDIA_TYPE } from "./media";

type FormAction = (
  state: CatPhotoFormState,
  formData: FormData,
) => Promise<CatPhotoFormState>;

type CatPhotoFormProps = {
  catId: string;
  action: FormAction;
  updateAction?: (
    recordId: string,
    state: CatPhotoFormState,
    formData: FormData,
  ) => Promise<CatPhotoFormState>;
  catPhoto?: CatPhoto;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: CatPhotoFormState = {};

export function CatPhotoForm({
  catId,
  action,
  updateAction,
  catPhoto,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: CatPhotoFormProps) {
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
    recordType: CAT_PHOTO_MEDIA_TYPE,
    media,
    redirectTo: `/cats/${catId}/photos`,
  });
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = catPhoto?.takenAt
    ? splitDateTimeUtc(catPhoto.takenAt)
    : getLocalNowParts(now);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <FormField
          name="takenDate"
          label="撮影日"
          type="date"
          defaultValue={defaultDate}
          errorMessage={state.fieldErrors?.takenDate?.[0]}
          isRequired
        />
        <FormField
          name="takenTime"
          label="撮影時刻"
          type="time"
          defaultValue={defaultTime}
          errorMessage={state.fieldErrors?.takenTime?.[0]}
          isRequired
        />
      </div>

      <MediaAttachmentField
        controller={media}
        label="写真"
        description="最新の撮影日時の写真が自動でプロフィール画像になります"
        isDisabled={isPending}
      />

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={catPhoto?.memo ?? ""}
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
