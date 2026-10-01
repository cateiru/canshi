"use client";

import { useActionState } from "react";
import {
  TbCake,
  TbCheck,
  TbScale,
  TbSpray,
  TbThermometer,
  TbWash,
} from "react-icons/tb";
import { Button, Checkbox, FormField } from "@/components/ui";
import type { CleaningTarget } from "@/db/schema";
import { Surface } from "@/features/shared/Surface";
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
      <Surface
        title="誕生日"
        icon={<TbCake aria-hidden="true" size={20} />}
        gap="sm"
      >
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
      </Surface>

      <Surface
        title="シャンプー"
        icon={<TbWash aria-hidden="true" size={20} />}
        gap="sm"
      >
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
      </Surface>

      <Surface
        title="体重測定"
        icon={<TbScale aria-hidden="true" size={20} />}
        gap="sm"
      >
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
      </Surface>

      <Surface
        title="症状"
        icon={<TbThermometer aria-hidden="true" size={20} />}
        gap="sm"
      >
        <Checkbox
          name="symptomOngoingEnabled"
          defaultSelected={settings.symptomOngoing.isEnabled}
        >
          1ヶ月以上解消していない症状を確認する
        </Checkbox>
      </Surface>

      {cleaningTargets.length > 0 ? (
        <Surface
          title="掃除"
          icon={<TbSpray aria-hidden="true" size={20} />}
          gap="sm"
        >
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
        </Surface>
      ) : null}

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        isDisabled={isPending}
        leftIcon={TbCheck}
      >
        {isPending ? "保存中..." : "保存する"}
      </Button>
    </form>
  );
}
