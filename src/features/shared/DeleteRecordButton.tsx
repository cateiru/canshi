"use client";

import { useState, useTransition } from "react";
import { TbTrash } from "react-icons/tb";
import { Button, Modal } from "@/components/ui";
import styles from "./DeleteRecordButton.module.css";

type DeleteRecordButtonProps = {
  action: () => Promise<void>;
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
          <Button
            variant="danger"
            isDisabled={isPending}
            onPress={() => startTransition(action)}
          >
            {isPending ? "削除中..." : "削除する"}
          </Button>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            キャンセル
          </Button>
        </div>
      </Modal>
    </>
  );
}
