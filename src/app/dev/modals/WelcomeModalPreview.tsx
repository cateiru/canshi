"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  householdInvitationPath,
  householdInvitationTokenFromUrl,
} from "@/features/households/domain/household";
import { INVALID_INVITATION_URL_MESSAGE } from "@/features/tour/domain/tour";
import { WelcomeModalView } from "@/features/tour/presentation/WelcomeModal";
import styles from "./page.module.css";

/**
 * はじめてログインしたときのウェルカムモーダル。本物は選んだあとに Cookie を書き換えてページを移るが、
 * ここでは選んだ結果を表示するだけにする（開発用のユーザーではじめてガイドがはじまらないように）
 */
export function WelcomeModalPreview() {
  // 閉じたあとにもう一度開いたとき、選択の画面・紙吹雪から始め直すため、開くたびに変える
  const [openedKey, setOpenedKey] = useState<number | null>(null);
  const [result, setResult] = useState<string>();

  const open = () => {
    setResult(undefined);
    setOpenedKey((prev) => (prev ?? 0) + 1);
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>ウェルカムモーダル</h2>
      <p className={styles.description}>
        はじめてログインしたときに開くモーダルです。「もっていない」と、正しい形の招待URLの「適用」は、モーダルを閉じて結果を表示します。
      </p>
      <div className={styles.buttons}>
        <Button onPress={open}>ウェルカムモーダルを開く</Button>
      </div>
      {result ? (
        <p role="status" className={styles.result}>
          {result}
        </p>
      ) : null}

      {openedKey !== null ? (
        <WelcomeModalView
          key={openedKey}
          onSkip={async () => {
            setOpenedKey(null);
            setResult(
              "「もっていない」を選びました。本物では、ホームへ移ってはじめてガイドをはじめます。",
            );
          }}
          onApply={async (invitationUrl) => {
            const token = householdInvitationTokenFromUrl(invitationUrl);
            if (!token) {
              return { error: INVALID_INVITATION_URL_MESSAGE };
            }
            setOpenedKey(null);
            setResult(
              `招待URLを適用しました。本物では ${householdInvitationPath(token)} へ移ります。`,
            );
          }}
        />
      ) : null}
    </section>
  );
}
