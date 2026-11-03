"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TbTrash } from "react-icons/tb";
import { addToast, Button, IconButton, Modal } from "@/components/ui";
import type { DeleteFoodProductResult } from "./actions";
import styles from "./DeleteFoodProductButton.module.css";

type DeleteFoodProductButtonProps = {
  action: () => Promise<DeleteFoodProductResult>;
  foodProductName: string;
  /**
   * 商品がごはん記録・プリセットに使われていて削除できないときの理由。
   * 渡すと、確認ダイアログで削除の代わりに理由だけを表示する
   */
  inUseMessage?: string;
};

export function DeleteFoodProductButton({
  action,
  foodProductName,
  inUseMessage,
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
      <IconButton
        icon={TbTrash}
        aria-label="削除する"
        title="削除する"
        aria-haspopup="dialog"
        onPress={() => setOpen(true)}
      />
      <Modal open={open} title="商品の削除" onClose={() => setOpen(false)}>
        {inUseMessage ? (
          <>
            <p>{inUseMessage}。</p>
            <div className={styles.actions}>
              <Button variant="secondary" onPress={() => setOpen(false)}>
                閉じる
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>
              「{foodProductName}」を削除しますか？この操作は取り消せません。
            </p>
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
          </>
        )}
      </Modal>
    </>
  );
}
