"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToast, Button, FormField, Modal } from "@/components/ui";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import type { CreateHouseholdInvitationActionResult } from "./actions";
import styles from "./HouseholdInvitationIssueButton.module.css";

type HouseholdInvitationIssueButtonProps = {
  householdName: string;
  action: () => Promise<CreateHouseholdInvitationActionResult>;
};

type IssuedInvitation = { url: string; expiresAt: Date };

/**
 * 家への招待 URL を発行するボタン。発行した URL はダイアログに表示し、コピー・共有できる。
 * DB にはトークンのハッシュしか残らないため、ダイアログを閉じると URL は表示し直せない
 */
export function HouseholdInvitationIssueButton({
  householdName,
  action,
}: HouseholdInvitationIssueButtonProps) {
  const router = useRouter();
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleIssue = () => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        addToast({ title: result.error, color: "error" });
        return;
      }
      setIssued({
        url: new URL(result.path, window.location.origin).toString(),
        expiresAt: new Date(result.expiresAt),
      });
    });
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast({ title: "招待 URL をコピーしました", color: "success" });
    } catch {
      addToast({
        title: "コピーできませんでした。URL を選択してコピーしてください",
        color: "error",
      });
    }
  };

  const handleShare = async (url: string) => {
    try {
      await navigator.share({
        title: `「${householdName}」への招待`,
        text: `CANSHI の「${householdName}」に招待されています。`,
        url,
      });
    } catch {
      // 共有シートを閉じただけのときも reject されるため、何もしない
    }
  };

  const handleClose = () => {
    setIssued(null);
    // 未使用の招待の一覧に、発行した招待を表示する
    router.refresh();
  };

  return (
    <>
      <Button variant="primary" isDisabled={isPending} onPress={handleIssue}>
        {isPending ? "発行中..." : "招待 URL を発行する"}
      </Button>
      <Modal open={issued !== null} title="招待 URL" onClose={handleClose}>
        {issued ? (
          <div className={styles.body}>
            <p>
              この URL を家族に送ってください。URL を開いた 1 人だけが「
              {householdName}」に参加できます。
            </p>
            <FormField
              label="招待 URL"
              value={issued.url}
              isReadOnly
              description={`有効期限: ${formatDateTimeUtc(getNaiveUtcNow(issued.expiresAt))}`}
              onFocus={(event) => event.target.select()}
            />
            <p className={styles.warning}>
              この画面を閉じると、URL
              は表示し直せません。わからなくなったときは、招待を無効化して発行し直してください。
            </p>
            <div className={styles.actions}>
              <Button variant="primary" onPress={() => handleCopy(issued.url)}>
                コピーする
              </Button>
              {/* ダイアログの中身は発行後にブラウザでだけ描画するため、navigator を直接参照できる */}
              {"share" in navigator ? (
                <Button onPress={() => handleShare(issued.url)}>
                  共有する
                </Button>
              ) : null}
              <Button variant="secondary" onPress={handleClose}>
                閉じる
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
