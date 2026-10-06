"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { addToast, Button, type ButtonVariant, Modal } from "@/components/ui";
import type { HouseholdMemberActionResult } from "./actions";
import styles from "./HouseholdMemberActionButton.module.css";

type HouseholdMemberActionButtonProps = {
  /** ボタンと確認ダイアログの実行ボタンに表示する文言（「家から外す」など） */
  label: string;
  /** 確認ダイアログの見出し */
  title: string;
  /** 確認ダイアログの本文 */
  description: ReactNode;
  /** 確認ダイアログの実行ボタンの見た目。取り消せない操作は danger にする */
  variant?: ButtonVariant;
  successMessage: string;
  action: () => Promise<HouseholdMemberActionResult>;
};

/**
 * 家のメンバーに対する操作（外す・オーナーを移譲する・家から抜ける）のボタン。
 * 確認ダイアログを挟んでから実行し、成功したら画面を取り直す（`redirectTo` があればそこへ移る）
 */
export function HouseholdMemberActionButton({
  label,
  title,
  description,
  variant = "primary",
  successMessage,
  action,
}: HouseholdMemberActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await action();
      setOpen(false);
      if (result.error) {
        addToast({ title: result.error, color: "error" });
        return;
      }
      addToast({ title: successMessage, color: "success" });
      if (result.redirectTo) {
        router.replace(result.redirectTo);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button aria-haspopup="dialog" onPress={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        <p>{description}</p>
        <div className={styles.actions}>
          <Button
            variant={variant}
            isDisabled={isPending}
            onPress={handleConfirm}
          >
            {isPending ? "処理中..." : label}
          </Button>
          <Button variant="secondary" onPress={() => setOpen(false)}>
            キャンセル
          </Button>
        </div>
      </Modal>
    </>
  );
}
