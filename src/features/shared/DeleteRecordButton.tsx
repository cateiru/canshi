"use client";

import { useState, useTransition } from "react";
import { TbTrash } from "react-icons/tb";
import { Button, Modal } from "@/components/ui";
import type { SubmitRedirect } from "@/features/navigation/types";
import { useNavigateAfterSubmit } from "@/features/navigation/useNavigateAfterSubmit";
import styles from "./DeleteRecordButton.module.css";

type DeleteRecordButtonProps = {
  /**
   * 削除する Server Action。一覧ページ上で削除する場合は Action 内で同じページへ `redirect` し、
   * 編集ページなどから削除する場合は遷移先を `redirectTo` で返す
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: `redirect` して値を返さない Action（Promise<void>）も受け付けるため
  action: () => Promise<void | SubmitRedirect>;
  title: string;
  description: string;
  iconOnly?: boolean;
  className?: string;
};

export function DeleteRecordButton({
  action,
  title,
  description,
  iconOnly = false,
  className,
}: DeleteRecordButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // 削除後の画面遷移が終わるまでは削除中として扱い、二重送信を防ぐ
  const [isNavigating, setIsNavigating] = useState(false);
  const navigateAfterSubmit = useNavigateAfterSubmit();
  const isBusy = isPending || isNavigating;
  const handleDelete = () => {
    startTransition(async () => {
      const result = await action();
      if (result?.redirectTo) {
        setIsNavigating(true);
        navigateAfterSubmit(result.redirectTo);
      }
    });
  };
  const trigger = (
    <Button
      variant="danger"
      className={className}
      aria-label={iconOnly ? "削除する" : undefined}
      aria-haspopup="dialog"
      onPress={() => setOpen(true)}
    >
      {iconOnly ? <TbTrash aria-hidden="true" size={20} /> : "削除する"}
    </Button>
  );

  return (
    <>
      {iconOnly ? <span title="削除する">{trigger}</span> : trigger}
      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        <p>{description}</p>
        <div className={styles.actions}>
          <Button variant="danger" isDisabled={isBusy} onPress={handleDelete}>
            {isBusy ? "削除中..." : "削除する"}
          </Button>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            キャンセル
          </Button>
        </div>
      </Modal>
    </>
  );
}
