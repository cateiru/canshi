"use client";

import { useActionState, useState } from "react";
import { Button, FormField, Select, type SelectOption } from "@/components/ui";
import styles from "./NotificationPreferencesForm.module.css";
import {
  type NotificationPreferencesFormState,
  updateNotificationPreferencesAction,
} from "./settingsActions";

type NotificationPreferencesFormProps = {
  notifyTime: string;
  timezone: string;
  timezoneOptions: SelectOption[];
};

const initialState: NotificationPreferencesFormState = {};

export function NotificationPreferencesForm({
  notifyTime,
  timezone,
  timezoneOptions,
}: NotificationPreferencesFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateNotificationPreferencesAction,
    initialState,
  );
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);

  function applyDeviceTimezone() {
    setSelectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="notifyTime"
        label="通知時刻"
        type="time"
        defaultValue={notifyTime}
        errorMessage={state.fieldErrors?.notifyTime?.[0]}
        isRequired
      />

      <div className={styles.timezoneRow}>
        <Select
          name="timezone"
          label="タイムゾーン"
          options={timezoneOptions}
          selectedKey={selectedTimezone}
          onSelectionChange={(key) => setSelectedTimezone(String(key))}
          errorMessage={state.fieldErrors?.timezone?.[0]}
        />
        <Button type="button" variant="secondary" onPress={applyDeviceTimezone}>
          端末のタイムゾーンを使う
        </Button>
      </div>

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button type="submit" variant="primary" isDisabled={isPending}>
        {isPending ? "保存中..." : "保存する"}
      </Button>
    </form>
  );
}
