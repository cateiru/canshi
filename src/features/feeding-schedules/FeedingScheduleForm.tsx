"use client";

import { useActionState } from "react";
import { TbDeviceFloppy, TbPlus } from "react-icons/tb";
import { Alert, Button, Checkbox, Select } from "@/components/ui";
import type { FeedingSchedule } from "@/db/schema";
import { NOTIFY_TIME_OPTIONS } from "@/features/cleaning/targetSchema";
import type { FeedingScheduleFormState } from "./actions";
import styles from "./FeedingScheduleForm.module.css";

type FeedingScheduleFormProps = {
  action: (
    state: FeedingScheduleFormState,
    formData: FormData,
  ) => Promise<FeedingScheduleFormState>;
  /** 指定したときは、そのごはんの時間の通知の設定を編集する。省略したときは時刻を選んで追加する */
  schedule?: Pick<
    FeedingSchedule,
    "time" | "notifyAtTime" | "remindIfNotRecorded"
  >;
};

const initialState: FeedingScheduleFormState = {};

const timeOptions = NOTIFY_TIME_OPTIONS.map((time) => ({
  value: time,
  label: time,
}));

/**
 * ごはんの時間の追加と、通知の設定の編集に使うフォーム。保存後も同じページにとどまり、
 * 結果をフォームの下に表示する
 */
export function FeedingScheduleForm({
  action,
  schedule,
}: FeedingScheduleFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const isNew = schedule == null;

  return (
    <form action={formAction} className={styles.form}>
      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}
      {isNew ? (
        <Select
          name="time"
          label="時刻（日本時間）"
          options={timeOptions}
          defaultSelectedKey="07:00"
          errorMessage={state.fieldErrors?.time?.[0]}
          isRequired
        />
      ) : null}
      <fieldset className={styles.checkboxes}>
        <legend className={styles.legend}>お知らせの設定</legend>
        <Checkbox
          name="notifyAtTime"
          defaultSelected={schedule?.notifyAtTime ?? true}
        >
          時間になったら通知する
        </Checkbox>
        <Checkbox
          name="remindIfNotRecorded"
          defaultSelected={schedule?.remindIfNotRecorded ?? true}
        >
          記録がないときに確認の通知をする
        </Checkbox>
      </fieldset>
      <div className={styles.footer}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={isPending}
          leftIcon={isNew ? TbPlus : TbDeviceFloppy}
        >
          {isPending ? "保存中..." : isNew ? "追加する" : "保存する"}
        </Button>
        <p role="status" className={styles.message}>
          {isPending ? null : state.message}
        </p>
      </div>
    </form>
  );
}
