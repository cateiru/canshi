"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Modal } from "@/components/ui";
import { markCatNeuteredAction } from "@/features/cats/presentation/actions";
import { markReplaceNavigation } from "@/features/navigation/history";
import styles from "./HospitalVisitForm.module.css";
import { hospitalVisitsHref } from "./neuterConfirm";

type NeuterStatusConfirmModalProps = {
  catId: string;
  catName: string;
  /** 避妊・去勢の呼び方。猫の性別に合わせる（`NEUTER_TERM`） */
  term: string;
};

/**
 * 避妊・去勢の通院記録を追加したあと、猫のプロフィールの避妊・去勢を「済」にするかを聞くダイアログ。
 * 通院記録一覧に `?confirmNeuter=1` を付けて開いたときに表示する。
 * 答えたら search を外した一覧に置き換え、再読み込みや戻る操作で聞き直さないようにする
 */
export function NeuterStatusConfirmModal({
  catId,
  catName,
  term,
}: NeuterStatusConfirmModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    const href = hospitalVisitsHref(catId);
    markReplaceNavigation(href);
    router.replace(href, { scroll: false });
  };

  const markNeutered = () => {
    setError(null);
    startTransition(async () => {
      const result = await markCatNeuteredAction(catId).catch(() => ({
        error: "保存できませんでした。もう一度お試しください",
      }));
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
    });
  };

  return (
    <Modal open={open} title="プロフィールの更新" onClose={close}>
      <p>
        {term}の通院記録が追加されましたが、{catName}ちゃんは{term}
        されましたか？
      </p>
      <p className={styles.modalNote}>
        「はい」を選ぶと、プロフィールの{term}を「済」にします。
      </p>
      {error ? (
        <p className={`${styles.modalNote} ${styles.errorMessage}`}>{error}</p>
      ) : null}
      <div className={styles.modalActions}>
        <Button variant="primary" isDisabled={isPending} onPress={markNeutered}>
          {isPending ? "保存中..." : "はい"}
        </Button>
        <Button variant="secondary" isDisabled={isPending} onPress={close}>
          いいえ
        </Button>
      </div>
    </Modal>
  );
}
