"use client";

import { useState } from "react";
import { TbCopy } from "react-icons/tb";
import { addToast, Button, FormField, Modal } from "@/components/ui";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { API_TOKEN_EXPIRATION_LABEL } from "../domain/labels";
import styles from "./IssuedApiTokenModal.module.css";

type IssuedApiTokenModalProps = {
  token: string;
  expiresAt: Date | null;
  onClose: () => void;
};

/**
 * 発行した API トークンを表示するダイアログ。DB にはトークンのハッシュしか残らないため、
 * 閉じるとトークンは表示し直せない
 */
export function IssuedApiTokenModal({
  token,
  expiresAt,
  onClose,
}: IssuedApiTokenModalProps) {
  // 閉じてから画面が移るまでの間に、トークンを表示し続けない
  const [open, setOpen] = useState(true);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      addToast({ title: "トークンをコピーしました", color: "success" });
    } catch {
      addToast({
        title: "コピーできませんでした。トークンを選択してコピーしてください",
        color: "error",
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Modal open={open} title="トークンを発行しました" onClose={handleClose}>
      <div className={styles.body}>
        <FormField
          label="API トークン"
          value={token}
          isReadOnly
          description={`有効期限: ${
            expiresAt
              ? formatDateTimeUtc(getNaiveUtcNow(expiresAt))
              : API_TOKEN_EXPIRATION_LABEL.none
          }`}
          onFocus={(event) => {
            if (event.target instanceof HTMLInputElement) {
              event.target.select();
            }
          }}
        />
        <p className={styles.warning}>
          この画面を閉じると、トークンは表示し直せません。安全な場所に保存し、ほかの人に見せないでください。わからなくなったときは、トークンを削除して発行し直してください。
        </p>
        <div className={styles.actions}>
          <Button variant="primary" leftIcon={TbCopy} onPress={handleCopy}>
            コピーする
          </Button>
        </div>
      </div>
    </Modal>
  );
}
