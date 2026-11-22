"use client";

import { useActionState, useState } from "react";
import { TbFileExport } from "react-icons/tb";
import { Alert, Button, Checkbox, FormGroup } from "@/components/ui";
import {
  RECORD_EXPORT_TYPE_LABEL,
  RECORD_EXPORT_TYPES,
  type RecordExportType,
} from "../domain/recordExport";
import type { RecordExportFormState } from "./actions";
import styles from "./RecordExportForm.module.css";

type RecordExportFormProps = {
  action: (
    state: RecordExportFormState,
    formData: FormData,
  ) => Promise<RecordExportFormState>;
  /** 家に処理中の出力があるか。処理中は新しく出力できない */
  isRunning: boolean;
};

const initialState: RecordExportFormState = {};

/** 出力する記録の種類と、写真・動画を含めるかを選んで出力を依頼するフォーム */
export function RecordExportForm({ action, isRunning }: RecordExportFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [selectedTypes, setSelectedTypes] = useState<Set<RecordExportType>>(
    () => new Set(RECORD_EXPORT_TYPES),
  );
  const allSelected = selectedTypes.size === RECORD_EXPORT_TYPES.length;
  const isDisabled = isPending || isRunning;

  return (
    <form action={formAction} className={styles.form}>
      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}
      <FormGroup
        legend="出力する記録"
        description="記録の種類ごとに CSV ファイルを作り、zip ファイルにまとめます。家のすべてのねこの記録を出力します。"
        errorMessage={state.fieldErrors?.recordTypes?.[0]}
        isDisabled={isDisabled}
      >
        <div className={styles.typeList}>
          {RECORD_EXPORT_TYPES.map((type) => (
            <Checkbox
              key={type}
              name="recordTypes"
              value={type}
              isSelected={selectedTypes.has(type)}
              onChange={(isSelected) =>
                setSelectedTypes((current) => {
                  const next = new Set(current);
                  if (isSelected) {
                    next.add(type);
                  } else {
                    next.delete(type);
                  }
                  return next;
                })
              }
            >
              {RECORD_EXPORT_TYPE_LABEL[type]}
            </Checkbox>
          ))}
        </div>
        <div>
          <Button
            variant="ghost"
            isDisabled={isDisabled}
            onPress={() =>
              setSelectedTypes(
                allSelected ? new Set() : new Set(RECORD_EXPORT_TYPES),
              )
            }
          >
            {allSelected ? "すべて外す" : "すべて選ぶ"}
          </Button>
        </div>
      </FormGroup>
      <FormGroup
        legend="写真・動画"
        description="うんち・嘔吐・症状・服薬・通院・支出の記録とメモに添付した写真・動画を、zip ファイルの photos フォルダに入れます。含めるとファイルが大きくなります。"
        isDisabled={isDisabled}
      >
        <Checkbox name="includeMedia">写真・動画を含める</Checkbox>
      </FormGroup>
      <div className={styles.footer}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={isDisabled || selectedTypes.size === 0}
          leftIcon={TbFileExport}
        >
          {isPending ? "依頼中..." : isRunning ? "出力中..." : "出力する"}
        </Button>
        <p role="status" className={styles.message}>
          {isPending ? null : state.message}
        </p>
      </div>
    </form>
  );
}
