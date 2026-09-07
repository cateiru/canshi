"use client";

import { useState, useTransition } from "react";
import { Button, Modal } from "@/components/ui";
import styles from "./DeleteRecordButton.module.css";

type DeleteRecordButtonProps = {
  action: () => Promise<void>;
  title: string;
  description: string;
};

export function DeleteRecordButton({
  action,
  title,
  description,
}: DeleteRecordButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" onPress={() => setOpen(true)}>
        削除する
      </Button>
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
