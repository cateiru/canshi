"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Label, Radio, RadioGroup } from "react-aria-components";
import { TbCheck } from "react-icons/tb";
import { Alert, Button, FormField, Modal } from "@/components/ui";
import { MEMO_LABEL_COLORS, type MemoLabelColor } from "@/db/schema";
import {
  MEMO_LABEL_NAME_MAX_LENGTH,
  type MemoLabelFormFieldErrors,
  type MemoLabelFormInput,
} from "../domain/labelSchema";
import { MEMO_LABEL_COLOR_LABEL } from "../domain/labels";
import type { MemoLabelView } from "../domain/memoLabel";
import type { SaveMemoLabelActionResult } from "./labelActions";
import { MemoLabelChip } from "./MemoLabelChip";
import styles from "./MemoLabelFormModal.module.css";

type MemoLabelFormProps = {
  /** 編集するラベル。省略すると、追加のフォームにする */
  label?: MemoLabelView;
  action: (input: MemoLabelFormInput) => Promise<SaveMemoLabelActionResult>;
  /** 保存に成功したとき。モーダルを閉じるのは呼び出し側で行う */
  onSaved: (label: MemoLabelView) => void;
  onClose: () => void;
};

type MemoLabelFormModalProps = MemoLabelFormProps & {
  open: boolean;
};

/**
 * メモのラベルを追加・編集するモーダル。
 * メモのフォームからも開くため、フォームの入れ子にならないよう、メモの `<form>` の外に置くこと
 */
export function MemoLabelFormModal({
  open,
  ...formProps
}: MemoLabelFormModalProps) {
  return (
    <Modal
      open={open}
      title={formProps.label ? "ラベルの編集" : "ラベルの追加"}
      onClose={formProps.onClose}
    >
      <MemoLabelForm {...formProps} />
    </Modal>
  );
}

function MemoLabelForm({
  label,
  action,
  onSaved,
  onClose,
}: MemoLabelFormProps) {
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState<MemoLabelColor>(label?.color ?? "gray");
  const [fieldErrors, setFieldErrors] = useState<MemoLabelFormFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // form の action に渡すと、入力エラーのときも React がフォームをリセットして入力が消えるため、
  // 送信を自分で受け取る
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await action({ name, color });
      if ("label" in result) {
        onSaved(result.label);
        return;
      }
      setFieldErrors("fieldErrors" in result ? result.fieldErrors : {});
      setFormError("formError" in result ? result.formError : undefined);
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {formError ? <Alert color="error">{formError}</Alert> : null}
      <FormField
        label="名前"
        value={name}
        onChange={setName}
        maxLength={MEMO_LABEL_NAME_MAX_LENGTH}
        placeholder="病院"
        errorMessage={fieldErrors.name?.[0]}
        isRequired
      />
      <RadioGroup
        className={styles.colors}
        orientation="horizontal"
        value={color}
        onChange={(value) => setColor(value as MemoLabelColor)}
      >
        <Label className={styles.colorsLabel}>色</Label>
        <div className={styles.colorOptions}>
          {MEMO_LABEL_COLORS.map((value) => (
            <Radio key={value} value={value} className={styles.colorOption}>
              <MemoLabelChip
                label={{ name: MEMO_LABEL_COLOR_LABEL[value], color: value }}
              />
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={isPending}
          leftIcon={TbCheck}
        >
          {isPending ? "保存中..." : label ? "更新する" : "追加する"}
        </Button>
        <Button variant="secondary" onPress={onClose}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
