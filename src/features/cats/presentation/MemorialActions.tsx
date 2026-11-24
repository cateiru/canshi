"use client";

import { useState, useTransition } from "react";
import { TbFlower } from "react-icons/tb";
import { Button, FormField, Modal } from "@/components/ui";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import type { MemorialFormState } from "./actions";
import styles from "./MemorialActions.module.css";

type MemorializeCatButtonProps = {
  action: (
    state: MemorialFormState,
    formData: FormData,
  ) => Promise<MemorialFormState>;
  catName: string;
  /** 日付の初期値・選べる最後の日（日本時間の今日、YYYY-MM-DD） */
  today: string;
};

const initialState: MemorialFormState = {};

/**
 * ねこをメモリー（思い出）へ移すボタンと確認のダイアログ。メモリーへ移した日を選んでから移す。
 * 旅立った猫のための操作のため、削除のような強い色・言葉は使わない
 */
export function MemorializeCatButton({
  action,
  catName,
  today,
}: MemorializeCatButtonProps) {
  const [open, setOpen] = useState(false);
  // 閉じて開き直したときに、前回の入力エラーを残さないようフォームを作り直す
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <Button
        variant="secondary"
        leftIcon={TbFlower}
        onPress={() => setOpen(true)}
      >
        メモリーへ移す
      </Button>
      <Modal
        open={open}
        title="メモリーへ移す"
        onClose={() => {
          setOpen(false);
          setFormKey((key) => key + 1);
        }}
      >
        <MemorializeCatForm
          key={formKey}
          action={action}
          catName={catName}
          today={today}
          onCancel={() => {
            setOpen(false);
            setFormKey((key) => key + 1);
          }}
        />
      </Modal>
    </>
  );
}

function MemorializeCatForm({
  action,
  catName,
  today,
  onCancel,
}: MemorializeCatButtonProps & { onCancel: () => void }) {
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );

  return (
    <>
      <p>
        {`「${catName}」をメモリーへ移すと、これまでの記録を思い出として残し、次のようになります。`}
      </p>
      <ul className={styles.list}>
        <li>
          記録の追加・編集・削除と、プロフィール・通知の設定の変更ができなくなります
        </li>
        <li>このねこのお知らせは届かなくなります</li>
        <li>タイムラインは、選んだ日までを表示します</li>
        <li>
          外部接続（AIとの接続・API）から、このねこの記録を書き込めなくなります
        </li>
      </ul>
      <p>あとからメモリーから戻すこともできます。</p>
      <form action={formAction} className={styles.form}>
        <FormField
          name="memorialDate"
          label="メモリーへ移す日"
          type="date"
          defaultValue={today}
          isRequired
          // サーバーの入力エラーを表示したあとも、日付を直して送り直せるよう、ブラウザの検証で送信を止めない
          validationBehavior="aria"
          errorMessage={state.fieldErrors?.memorialDate?.[0]}
          isDisabled={isPending}
        />
        {state.formError ? (
          <p className={styles.errorMessage}>{state.formError}</p>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" variant="primary" isDisabled={isPending}>
            {isPending ? "移しています..." : "メモリーへ移す"}
          </Button>
          <Button variant="secondary" onPress={onCancel}>
            キャンセル
          </Button>
        </div>
      </form>
    </>
  );
}

type RestoreCatFromMemorialButtonProps = {
  action: () => Promise<{ error?: string }>;
  catName: string;
};

/** メモリーへ移したねこを元に戻すボタンと確認のダイアログ */
export function RestoreCatFromMemorialButton({
  action,
  catName,
}: RestoreCatFromMemorialButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setError(undefined);
  };

  return (
    <>
      <Button variant="secondary" onPress={() => setOpen(true)}>
        メモリーから戻す
      </Button>
      <Modal open={open} title="メモリーから戻す" onClose={close}>
        <p>
          {`「${catName}」をメモリーから戻すと、記録の追加・編集やお知らせが元どおりできるようになります。`}
        </p>
        <ul className={styles.list}>
          <li>メモリーへ移したときに閉じたお知らせは、戻りません</li>
          <li>
            外部接続（AIとの接続・API）の書き込みの許可は戻りません。必要なら設定の「外部接続」で許可し直してください
          </li>
        </ul>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (isPending) {
              return;
            }
            startTransition(async () => {
              const result = await action();
              if (result.error) {
                setError(result.error);
                return;
              }
              close();
            });
          }}
        >
          {error ? <p className={styles.errorMessage}>{error}</p> : null}
          <div className={styles.actions}>
            <Button type="submit" variant="primary" isDisabled={isPending}>
              {isPending ? "戻しています..." : "メモリーから戻す"}
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
