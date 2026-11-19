"use client";

import { usePathname } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { TbArrowRight } from "react-icons/tb";
import { Button, FormField, Modal } from "@/components/ui";
import { isTourHiddenPath } from "../domain/tour";
import { applyInvitationUrlAction, skipInvitationAction } from "./actions";
import { BurstConfetti } from "./BurstConfetti";
import styles from "./WelcomeModal.module.css";

type WelcomeStep = "choice" | "invitation";

/**
 * はじめてログインしたユーザーに出すウェルカムモーダル。紙吹雪でお祝いし、招待 URL を持っているかを聞く。
 * 持っていれば入力した招待 URL のページへ、持っていなければモーダルを閉じてホームではじめてガイドをはじめる。
 * どちらかを選ぶまで閉じない
 */
export function WelcomeModal() {
  const pathname = usePathname();

  // 招待のページなど、ほかの操作の途中の画面では出さない（はじめてガイドのパネルと同じ）
  if (isTourHiddenPath(pathname)) {
    return null;
  }

  return (
    <WelcomeModalView
      onSkip={skipInvitationAction}
      onApply={applyInvitationUrlAction}
    />
  );
}

type WelcomeModalViewProps = {
  /** 「もっていない」を選んだとき */
  onSkip: () => Promise<void>;
  /**
   * 招待 URL を「適用」したとき。適用できなければエラーを返す（適用できたときは、本物ではサーバーが
   * 招待のページへ移すため返らない）
   */
  onApply: (invitationUrl: string) => Promise<{ error?: string } | undefined>;
};

/**
 * ウェルカムモーダルの見た目と操作。選んだあとの処理は受け取り、Cookie もページの位置も見ない。
 * 開発用ページ（`/dev/modals`）で、ログインの状態に関わらず表示を確かめるためにも使う
 */
export function WelcomeModalView({ onSkip, onApply }: WelcomeModalViewProps) {
  const [step, setStep] = useState<WelcomeStep>("choice");
  const [isSkipping, startSkip] = useTransition();
  const [invitationUrl, setInvitationUrl] = useState("");
  const [error, setError] = useState<string>();
  const [isApplying, startApply] = useTransition();

  const skip = () => {
    startSkip(async () => {
      await onSkip();
    });
  };

  // 適用できたときは、サーバーが招待のページへ移す。エラーのときは入力を残したままエラーを出す
  // （`<form action>` にすると、送信のあとに入力欄が空に戻るため、送信を自分で扱う）
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startApply(async () => {
      const result = await onApply(invitationUrl);
      setError(result?.error);
    });
  };

  return (
    <>
      <BurstConfetti />
      <Modal
        open
        isDismissable={false}
        // 招待 URL の入力画面では、右上の ✕ で「もっているか」の選択に戻る
        closeButtonLabel={step === "invitation" ? "閉じる" : undefined}
        onClose={() => setStep("choice")}
        title={
          step === "choice"
            ? "アカウントを作成いただきありがとうございます！"
            : "もっている招待URLを入力してください"
        }
      >
        {step === "choice" ? (
          <div className={styles.body}>
            <p>とつぜんですが、招待URLはお持ちですか？</p>
            <div className={styles.choices}>
              <Button
                variant="secondary"
                rightIcon={TbArrowRight}
                className={styles.choice}
                isDisabled={isSkipping}
                onPress={() => setStep("invitation")}
              >
                もっている
              </Button>
              <Button
                variant="secondary"
                rightIcon={TbArrowRight}
                className={styles.choice}
                isDisabled={isSkipping}
                onPress={skip}
              >
                もっていない
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={apply} className={styles.body}>
            <FormField
              name="invitationUrl"
              label="招待URL"
              inputMode="url"
              autoComplete="off"
              placeholder="https://…/invitations/…"
              value={invitationUrl}
              onChange={(value) => {
                setInvitationUrl(value);
                // 入力し直したらエラーを消す。エラーを出したままだと、入力欄が無効のまま
                // （ブラウザの入力検証で）送信できない
                setError(undefined);
              }}
              errorMessage={error}
              isRequired
              autoFocus
            />
            <Button
              type="submit"
              variant="primary"
              className={styles.submit}
              isDisabled={isApplying}
            >
              {isApplying ? "適用しています..." : "適用"}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
