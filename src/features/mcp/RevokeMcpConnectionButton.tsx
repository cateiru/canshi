"use client";

import { useState, useTransition } from "react";
import { addToast, Button, Modal } from "@/components/ui";
import { revokeMcpConnectionAction } from "./actions";
import styles from "./RevokeMcpConnectionButton.module.css";

type RevokeMcpConnectionButtonProps = {
  connectionId: string;
  /** 確認ダイアログに表示するアプリの名前 */
  clientName: string;
  /** 確認ダイアログに表示する接続日時。同じ名前のアプリが並んだときに見分けるため */
  connectedAt: string;
};

/**
 * AI との接続の一覧で、指定した接続を解除するボタン。確認ダイアログを挟んでから実行する。
 * 一覧はアクションの `revalidatePath` で取り直される
 */
export function RevokeMcpConnectionButton({
  connectionId,
  clientName,
  connectedAt,
}: RevokeMcpConnectionButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await revokeMcpConnectionAction(connectionId);
      setOpen(false);
      addToast({
        title: `「${clientName}」との接続を解除しました`,
        color: "success",
      });
    });
  };

  return (
    <>
      <Button aria-haspopup="dialog" onPress={() => setOpen(true)}>
        解除
      </Button>
      <Modal
        open={open}
        title="接続を解除しますか？"
        onClose={() => setOpen(false)}
      >
        <p>
          {connectedAt} に接続した「{clientName}
          」との接続を解除します。解除すると、このアプリからは猫のプロフィールや記録を読み取れなくなります。もう一度使うには、アプリから接続し直してください。
        </p>
        <div className={styles.actions}>
          <Button
            variant="danger"
            isDisabled={isPending}
            onPress={handleConfirm}
          >
            {isPending ? "処理中..." : "解除"}
          </Button>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            キャンセル
          </Button>
        </div>
      </Modal>
    </>
  );
}
