"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Modal } from "@/components/ui";
import { logoutAllDevicesAction } from "./actions";
import styles from "./LogoutAllDevicesButton.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" isDisabled={pending}>
      {pending ? "処理中..." : "すべての端末からログアウト"}
    </Button>
  );
}

/**
 * 「すべての端末からログアウト」のボタン。この端末を含むすべての端末のセッションを
 * 削除するため、確認ダイアログを挟んでから実行する
 */
export function LogoutAllDevicesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="danger"
        aria-haspopup="dialog"
        onPress={() => setOpen(true)}
      >
        すべての端末からログアウト
      </Button>
      <Modal
        open={open}
        title="すべての端末からログアウトしますか？"
        onClose={() => setOpen(false)}
      >
        <p>
          この端末を含め、ログインしているすべての端末（スマートフォン・パソコンなど）からログアウトします。続けて使うには、それぞれの端末でもう一度ログインしてください。
        </p>
        <form action={logoutAllDevicesAction} className={styles.actions}>
          <SubmitButton />
          <Button variant="secondary" onPress={() => setOpen(false)}>
            キャンセル
          </Button>
        </form>
      </Modal>
    </>
  );
}
