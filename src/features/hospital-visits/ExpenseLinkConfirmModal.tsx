"use client";

import { useState } from "react";
import { Button, Modal, Radio, RadioGroup } from "@/components/ui";
import { formatYen } from "@/features/expenses/labels";
import type { HospitalExpenseCandidate } from "@/features/expenses/queries";
import styles from "./HospitalVisitForm.module.css";

type ExpenseLinkConfirmModalProps = {
  /** 受診日と同じ日のカテゴリ「病院」の支出記録。null のときは閉じる */
  candidates: HospitalExpenseCandidate[] | null;
  onLink: (expenseRecordId: string) => void;
  onSkip: () => void;
  onCancel: () => void;
};

function candidateLabel(candidate: HospitalExpenseCandidate): string {
  const cats =
    candidate.catNames.length > 0
      ? candidate.catNames.join("、")
      : "関連する猫なし";
  return `${formatYen(candidate.amountYen)}（${cats}）${candidate.memo ? ` ${candidate.memo}` : ""}`;
}

/**
 * 通院記録の作成時、受診日と同じ日に「病院」の支出記録があれば、
 * その支出を病院代として紐付けるかを確認するモーダル
 */
export function ExpenseLinkConfirmModal({
  candidates,
  onLink,
  onSkip,
  onCancel,
}: ExpenseLinkConfirmModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 開き直したときに前回の選択が候補にない場合は、先頭の候補を選ぶ
  const effectiveId =
    candidates?.find((candidate) => candidate.id === selectedId)?.id ??
    candidates?.[0]?.id ??
    null;

  return (
    <Modal
      open={candidates != null}
      title="支出記録と紐付けますか？"
      onClose={onCancel}
    >
      <p>
        同じ日に「病院」の支出記録があります。この通院記録の病院代として紐付けると、支出記録の関連する猫にもこの猫が追加されます。
      </p>
      {candidates != null && candidates.length > 1 ? (
        <RadioGroup
          className={styles.candidates}
          aria-label="紐付ける支出記録"
          value={effectiveId}
          onChange={setSelectedId}
        >
          {candidates.map((candidate) => (
            <Radio key={candidate.id} value={candidate.id}>
              {candidateLabel(candidate)}
            </Radio>
          ))}
        </RadioGroup>
      ) : candidates?.[0] ? (
        <p className={styles.candidates}>{candidateLabel(candidates[0])}</p>
      ) : null}
      <div className={styles.modalActions}>
        <Button
          variant="primary"
          isDisabled={effectiveId == null}
          onPress={() => {
            if (effectiveId != null) onLink(effectiveId);
          }}
        >
          紐付けて記録する
        </Button>
        <Button variant="secondary" onPress={onSkip}>
          紐付けずに記録する
        </Button>
      </div>
    </Modal>
  );
}
