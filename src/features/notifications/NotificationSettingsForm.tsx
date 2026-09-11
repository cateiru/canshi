"use client";

import { useActionState } from "react";
import { Button, Checkbox, FormField, Heading } from "@/components/ui";
import type { CleaningTarget } from "@/db/schema";
import styles from "./NotificationSettingsForm.module.css";
import type { ResolvedNotificationSettings } from "./rules";
import type { CatNotificationSettingsFormState } from "./settingsActions";

type NotificationSettingsFormProps = {
  action: (
    state: CatNotificationSettingsFormState,
    formData: FormData,
  ) => Promise<CatNotificationSettingsFormState>;
  settings: ResolvedNotificationSettings;
  cleaningTargets: CleaningTarget[];
};

const initialState: CatNotificationSettingsFormState = {};

export function NotificationSettingsForm({
  action,
  settings,
  cleaningTargets,
}: NotificationSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <section className={styles.section}>
        <Heading level={2} size="md">
          誕生日
        </Heading>
        <Checkbox
          name="birthdayYearlyEnabled"
          defaultSelected={settings.birthdayYearly.isEnabled}
        >
          年ごとの誕生日を通知する
        </Checkbox>
        <Checkbox
          name="birthdayHalfYearEnabled"
          defaultSelected={settings.birthdayHalfYear.isEnabled}
        >
          半年ごとの節目を通知する
        </Checkbox>
        <Checkbox
          name="daysMilestoneEnabled"
          defaultSelected={settings.daysMilestone.isEnabled}
        >
          生後100日ごとの節目を通知する
        </Checkbox>
      </section>

      <section className={styles.section}>
        <Heading level={2} size="md">
          シャンプー
        </Heading>
        <Checkbox
          name="shampooElapsedEnabled"
          defaultSelected={settings.shampooElapsed.isEnabled}
        >
          シャンプー経過の通知を有効にする
        </Checkbox>
        <FormField
          name="shampooElapsedMonths"
          label="経過月数"
          type="number"
          inputMode="numeric"
          defaultValue={settings.shampooElapsed.months.toString()}
          errorMessage={state.fieldErrors?.shampooElapsedMonths?.[0]}
          isRequired
        />
      </section>

      <section className={styles.section}>
        <Heading level={2} size="md">
          体重測定
        </Heading>
        <Checkbox
          name="weightMeasurementEnabled"
          defaultSelected={settings.weightMeasurement.isEnabled}
        >
          体重測定の提案を有効にする
        </Checkbox>
        <FormField
          name="weightMeasurementDays"
          label="経過日数"
          type="number"
          inputMode="numeric"
          defaultValue={settings.weightMeasurement.days.toString()}
          errorMessage={state.fieldErrors?.weightMeasurementDays?.[0]}
          isRequired
        />
      </section>

      {cleaningTargets.length > 0 ? (
        <section className={styles.section}>
          <Heading level={2} size="md">
            掃除
          </Heading>
          {cleaningTargets.map((target) => (
            <Checkbox
              key={target.id}
              name={`cleaningEnabled_${target.id}`}
              defaultSelected={
                settings.cleaningDue.get(target.id)?.isEnabled ?? true
              }
            >
              {target.name}の通知を有効にする
            </Checkbox>
          ))}
        </section>
      ) : null}

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button type="submit" variant="primary" isDisabled={isPending}>
        {isPending ? "保存中..." : "保存する"}
      </Button>
    </form>
  );
}
