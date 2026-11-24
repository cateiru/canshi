"use client";

import { useState, useTransition } from "react";
import { addToast, Button, Modal } from "@/components/ui";
import { deleteApiTokenAction } from "./actions";
import styles from "./DeleteApiTokenButton.module.css";

type DeleteApiTokenButtonProps = {
  tokenId: string;
  /** 確認ダイアログに表示するトークンの名前 */
  tokenName: string;
  /** 確認ダイアログに表示する発行日時。同じ名前のトークンが並んだときに見分けるため */
  createdAt: string;
};

/**
 * API トークンの一覧で、指定したトークンを削除するボタン。確認ダイアログを挟んでから実行する。
 * 一覧はアクションの `revalidatePath` で取り直される
 */
export function DeleteApiTokenButton({
  tokenId,
  tokenName,
  createdAt,
}: DeleteApiTokenButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await deleteApiTokenAction(tokenId);
      setOpen(false);
      addToast({
        title: `「${tokenName}」を削除しました`,
        color: "success",
      });
    });
  };

  return (
    <>
      <Button aria-haspopup="dialog" onPress={() => setOpen(true)}>
        削除
      </Button>
      <Modal
        open={open}
        title="トークンを削除しますか？"
        onClose={() => setOpen(false)}
      >
        <p>
          {createdAt} に発行した「{tokenName}
          」を削除します。削除すると、このトークンでは API
          を使えなくなり、アクセスの履歴も消えます。このトークンで追加・編集した記録は残ります。
        </p>
        <div className={styles.actions}>
          <Button
            variant="danger"
            isDisabled={isPending}
            onPress={handleConfirm}
          >
            {isPending ? "処理中..." : "削除する"}
          </Button>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            キャンセル
          </Button>
        </div>
      </Modal>
    </>
  );
}
