import { Alert, Button, Modal } from "@canshi/shared/ui";
import { type ReactNode, useState } from "react";
import common from "../common.module.css";
import styles from "./ConfirmDialog.module.css";

/**
 * 取り消せない操作の前に確かめるダイアログ。決定すると `onConfirm` を呼び、終わるまでボタンを
 * 押せなくする。失敗したときは理由を表示し、閉じずに残す
 */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** 削除など、取り消せない操作は danger にする */
  variant?: "primary" | "danger";
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isPending) {
      return;
    }
    setError(null);
    props.onClose();
  };

  const confirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      await props.onConfirm();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "操作に失敗しました",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal open={props.open} title={props.title} onClose={close}>
      <div className={common.stack}>
        <div className={styles.message}>{props.children}</div>
        {error ? (
          <Alert color="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <div className={styles.buttons}>
          <Button
            variant={props.variant ?? "primary"}
            isDisabled={isPending}
            onPress={confirm}
          >
            {isPending ? "処理中..." : props.confirmLabel}
          </Button>
          <Button variant="secondary" isDisabled={isPending} onPress={close}>
            キャンセル
          </Button>
        </div>
      </div>
    </Modal>
  );
}
