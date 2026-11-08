"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToast, Button, FormField, Modal } from "@/components/ui";
import { useNavigateAfterSubmit } from "@/features/navigation/useNavigateAfterSubmit";
import type { HouseholdMemberActionResult } from "./actions";
import styles from "./DeleteHouseholdButton.module.css";

type DeleteHouseholdButtonProps = {
  action: () => Promise<HouseholdMemberActionResult>;
  householdName: string;
  /** 家に猫がいるなど、削除できないときに true。ボタンを押せなくする */
  isDisabled?: boolean;
};

/**
 * 家を削除するボタン。家の支出記録・ごはん商品などをまとめて消す操作なので、猫の削除
 * （`DeleteCatButton`）と同じく、家の名前を正確に入力したときだけ削除できる確認ダイアログを挟む
 */
export function DeleteHouseholdButton({
  action,
  householdName,
  isDisabled = false,
}: DeleteHouseholdButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isTransitionPending, startTransition] = useTransition();
  // 削除後の画面遷移が終わるまでは削除中として扱い、二重送信を防ぐ
  const [isNavigating, setIsNavigating] = useState(false);
  const navigateAfterSubmit = useNavigateAfterSubmit();
  const isPending = isTransitionPending || isNavigating;
  const isConfirmed = confirmName === householdName;

  const close = () => {
    setOpen(false);
    setConfirmName("");
  };

  return (
    <>
      <Button
        variant="danger"
        aria-haspopup="dialog"
        isDisabled={isDisabled}
        onPress={() => setOpen(true)}
      >
        家を削除する
      </Button>
      <Modal open={open} title="家の削除" onClose={close}>
        <p>
          {`「${householdName}」を削除しますか？この家の支出記録・ごはん商品・ごはんプリセット・ごはんの時間・招待もすべて削除され、メンバー全員がこの家を見られなくなります。この操作は取り消せません。`}
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (isConfirmed && !isPending) {
              startTransition(async () => {
                const result = await action();
                if (result.error) {
                  // 確認から削除までの間に猫が登録された場合などは、理由を伝えて画面を取り直す
                  close();
                  addToast({ title: result.error, color: "error" });
                  router.refresh();
                  return;
                }
                addToast({
                  title: `「${householdName}」を削除しました`,
                  color: "success",
                });
                if (result.redirectTo) {
                  setIsNavigating(true);
                  navigateAfterSubmit(result.redirectTo);
                }
              });
            }
          }}
        >
          <FormField
            label={`確認のため「${householdName}」と入力してください`}
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
