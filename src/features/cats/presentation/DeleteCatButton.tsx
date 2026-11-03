"use client";

import { useState, useTransition } from "react";
import { Button, FormField, Modal } from "@/components/ui";
import type { SubmitRedirect } from "@/features/navigation/types";
import { useNavigateAfterSubmit } from "@/features/navigation/useNavigateAfterSubmit";
import styles from "./DeleteCatButton.module.css";

type DeleteCatButtonProps = {
  action: () => Promise<SubmitRedirect>;
  catName: string;
};

export function DeleteCatButton({ action, catName }: DeleteCatButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isTransitionPending, startTransition] = useTransition();
  // 削除後の画面遷移が終わるまでは削除中として扱い、二重送信を防ぐ
  const [isNavigating, setIsNavigating] = useState(false);
  const navigateAfterSubmit = useNavigateAfterSubmit();
  const isPending = isTransitionPending || isNavigating;
  // 猫と記録をまとめて消す操作なので、誤操作を防ぐため猫の名前を正確に入力したときだけ削除できるようにする
  const isConfirmed = confirmName === catName;

  const close = () => {
    setOpen(false);
    setConfirmName("");
  };

  return (
    <>
      <Button variant="danger" onPress={() => setOpen(true)}>
        削除する
      </Button>
      <Modal open={open} title="猫の削除" onClose={close}>
        <p>
          {`「${catName}」を削除しますか？この猫の記録と写真もすべて削除され、この操作は取り消せません。`}
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (isConfirmed && !isPending) {
              startTransition(async () => {
                const result = await action();
                if (result.redirectTo) {
                  setIsNavigating(true);
                  navigateAfterSubmit(result.redirectTo);
                }
              });
            }
          }}
        >
          <FormField
            label={`確認のため「${catName}」と入力してください`}
            value={confirmName}
            onChange={setConfirmName}
            autoComplete="off"
            isDisabled={isPending}
          />
          <div className={styles.actions}>
            <Button
              type="submit"
              variant="danger"
              isDisabled={!isConfirmed || isPending}
            >
              {isPending ? "削除中..." : "削除する"}
            </Button>
            <Button variant="secondary" onPress={close}>
              キャンセル
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
