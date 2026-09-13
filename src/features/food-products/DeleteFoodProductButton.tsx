"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TbTrash } from "react-icons/tb";
import { addToast, Button, Modal } from "@/components/ui";
import type { DeleteFoodProductResult } from "./actions";
import styles from "./DeleteFoodProductButton.module.css";

type DeleteFoodProductButtonProps = {
  className?: string;
  action: () => Promise<DeleteFoodProductResult>;
  foodProductName: string;
};

export function DeleteFoodProductButton({
  action,
  className,
  foodProductName,
}: DeleteFoodProductButtonProps) {
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
      <span title="削除する">
        <Button
          variant="danger"
          className={className}
          aria-label="削除する"
          aria-haspopup="dialog"
          onPress={() => setOpen(true)}
        >
          <TbTrash aria-hidden="true" size={20} />
        </Button>
      </span>
      <Modal open={open} title="商品の削除" onClose={() => setOpen(false)}>
        <p>「{foodProductName}」を削除しますか？この操作は取り消せません。</p>
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
