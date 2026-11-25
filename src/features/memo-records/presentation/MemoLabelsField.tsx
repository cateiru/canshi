"use client";

import { ToggleButton } from "react-aria-components";
import { TbCheck, TbPlus } from "react-icons/tb";
import { Button, FormGroup } from "@/components/ui";
import type { MemoLabelView } from "../domain/memoLabel";
import { MemoLabelChip } from "./MemoLabelChip";
import styles from "./MemoLabelsField.module.css";

type MemoLabelsFieldProps = {
  /** 選べるラベル（猫の家のラベル） */
  labels: readonly MemoLabelView[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string, isSelected: boolean) => void;
  /** 「新しいラベル」を押したとき。追加のモーダルはフォームの外に置くため、呼び出し側で開く */
  onAdd: () => void;
  isDisabled: boolean;
  errorMessage?: string;
};

/**
 * メモに付けるラベルの選択。複数を選べる。
 * フォームのリセット（入力エラーの後など）で選択が消えないよう、選択は状態で持ち、hidden の input で送る
 */
export function MemoLabelsField({
  labels,
  selectedIds,
  onToggle,
  onAdd,
  isDisabled,
  errorMessage,
}: MemoLabelsFieldProps) {
  return (
    <FormGroup
      legend="ラベル"
      errorMessage={errorMessage}
      isDisabled={isDisabled}
    >
      <div className={styles.field}>
        {labels.length > 0 ? (
          <div className={styles.options}>
            {labels.map((label) => {
              const isSelected = selectedIds.has(label.id);
              return (
                <ToggleButton
                  key={label.id}
                  className={styles.option}
                  isSelected={isSelected}
                  onChange={(next) => onToggle(label.id, next)}
                  isDisabled={isDisabled}
                >
                  {isSelected ? (
                    <TbCheck
                      className={styles.selectedMark}
                      aria-hidden="true"
                    />
                  ) : null}
                  <MemoLabelChip label={label} />
                </ToggleButton>
              );
            })}
          </div>
        ) : null}
        {labels
          .filter(({ id }) => selectedIds.has(id))
          .map(({ id }) => (
            <input key={id} type="hidden" name="labelIds" value={id} />
          ))}
        <Button leftIcon={TbPlus} aria-haspopup="dialog" onPress={onAdd}>
          新しいラベル
        </Button>
      </div>
    </FormGroup>
  );
}
