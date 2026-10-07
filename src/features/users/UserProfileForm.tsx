"use client";

import { useActionState, useState } from "react";
import { TbCheck, TbId } from "react-icons/tb";
import { Alert, Button, FormField } from "@/components/ui";
import { PhotoIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { ProfileImageField } from "@/features/cats/ProfileImageField";
import { Surface } from "@/features/shared/Surface";
import type { UserProfileFormState } from "./actions";
import { UserAvatar } from "./UserAvatar";
import styles from "./UserProfileForm.module.css";

type UserProfileFormProps = {
  action: (
    state: UserProfileFormState,
    formData: FormData,
  ) => Promise<UserProfileFormState>;
  defaultName: string;
  iconMediaAssetId: string | null;
};

const initialState: UserProfileFormState = {};

/**
 * ログイン中のユーザーの名前とアイコン画像を変えるフォーム。保存後も同じページにとどまり、
 * 結果をフォームの下に表示する
 */
export function UserProfileForm({
  action,
  defaultName,
  iconMediaAssetId,
}: UserProfileFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [isIconBusy, setIsIconBusy] = useState(false);
  const name = state.submittedName ?? defaultName;

  return (
    <form action={formAction} className={styles.form}>
      <Surface
        titleId="profile-basic-heading"
        title="基本情報"
        titleSize="lg"
        icon={<TbId aria-hidden="true" size={20} />}
        gap="md"
      >
        <p className={styles.description}>
          家のメンバーの一覧などで、ほかのメンバーにも表示されます。
        </p>
        <FormField
          // 入力エラーで戻したときは、送信した名前で入力欄を作り直す
          key={name}
          name="name"
          label="名前"
          defaultValue={name}
          errorMessage={state.fieldErrors?.name?.[0]}
          isRequired
        />
      </Surface>

      <Surface
        titleId="profile-icon-heading"
        title="アイコン"
        titleSize="lg"
        icon={<PhotoIcon aria-hidden="true" size={24} />}
        gap="md"
      >
        <p className={styles.description}>
          画像を選ぶと、正方形に切り抜く範囲を調整できます。
        </p>
        <ProfileImageField
          // 保存したら、選んだ画像を保存済みの画像として表示し直す
          key={state.savedAt ?? 0}
          currentAssetId={iconMediaAssetId}
          renderPreview={(assetId) => (
            <UserAvatar name={name} iconMediaAssetId={assetId} size="lg" />
          )}
          pendingNote="「保存する」を押すと反映されます。"
          imageLabel="アイコン画像"
          onBusyChange={setIsIconBusy}
          isDisabled={isPending}
        />
      </Surface>

      {state.formError ? <Alert color="error">{state.formError}</Alert> : null}

      <div className={styles.footer}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={isPending || isIconBusy}
          leftIcon={TbCheck}
        >
          {isPending ? "保存中..." : "保存する"}
        </Button>
        <p role="status" className={styles.message}>
          {isPending ? null : state.message}
        </p>
      </div>
    </form>
  );
}
