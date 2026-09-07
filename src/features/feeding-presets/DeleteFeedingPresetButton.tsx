"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToast, Button, Modal } from "@/components/ui";
import type { DeleteFeedingPresetResult } from "./actions";
import styles from "./DeleteFeedingPresetButton.module.css";

type DeleteFeedingPresetButtonProps = {
  action: () => Promise<DeleteFeedingPresetResult>;
  presetName: string;
};

export function DeleteFeedingPresetButton({
  action,
  presetName,
}: DeleteFeedingPresetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await action();
      setOpen(false);
      if (result?.error) {
        addToast({ title: result.error, color: "error" });
      } else {
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button variant="danger" onPress={() => setOpen(true)}>
        削除する
      </Button>
      <Modal
        open={open}
        title="プリセットの削除"
        onClose={() => setOpen(false)}
      >
        <p>「{presetName}」を削除しますか？この操作は取り消せません。</p>
        <div className={styles.actions}>
          <Button
            variant="danger"
            isDisabled={isPending}
            onPress={handleDelete}
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
