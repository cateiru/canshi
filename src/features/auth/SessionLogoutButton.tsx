"use client";

import { useState, useTransition } from "react";
import { addToast, Button, Modal } from "@/components/ui";
import { logoutSessionAction } from "./actions";
import styles from "./SessionLogoutButton.module.css";

type SessionLogoutButtonProps = {
  sessionId: string;
  /** 確認ダイアログに表示する端末名 */
  deviceName: string;
  /** 確認ダイアログに表示するログイン日時。同じ端末名が並んだときに見分けるため */
  loggedInAt: string;
};

/**
 * 端末一覧で、指定した端末をログアウトさせるボタン。確認ダイアログを挟んでから実行する。
 * 一覧はアクションの `revalidatePath` で取り直される
 */
export function SessionLogoutButton({
  sessionId,
  deviceName,
  loggedInAt,
}: SessionLogoutButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await logoutSessionAction(sessionId);
      setOpen(false);
      addToast({
        title: `「${deviceName}」をログアウトしました`,
        color: "success",
      });
    });
  };

  return (
    <>
      <Button aria-haspopup="dialog" onPress={() => setOpen(true)}>
        ログアウト
      </Button>
      <Modal
        open={open}
        title="端末をログアウトしますか？"
        onClose={() => setOpen(false)}
      >
        <p>
          {loggedInAt} にログインした「{deviceName}
          」をログアウトします。続けて使うには、その端末でもう一度ログインしてください。
        </p>
        <div className={styles.actions}>
          <Button
            variant="danger"
            isDisabled={isPending}
            onPress={handleConfirm}
          >
            {isPending ? "処理中..." : "ログアウト"}
          </Button>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            キャンセル
          </Button>
        </div>
      </Modal>
    </>
  );
}
