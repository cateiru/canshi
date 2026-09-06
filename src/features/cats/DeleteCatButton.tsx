"use client";

import { useState, useTransition } from "react";
import { Button, Modal } from "@/components/ui";
import styles from "./DeleteCatButton.module.css";

type DeleteCatButtonProps = {
  action: () => Promise<void>;
  catName: string;
};

export function DeleteCatButton({ action, catName }: DeleteCatButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" onPress={() => setOpen(true)}>
        削除する
      </Button>
      <Modal open={open} title="猫の削除" onClose={() => setOpen(false)}>
        <p>「{catName}」を削除しますか？この操作は取り消せません。</p>
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
