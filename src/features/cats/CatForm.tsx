"use client";

import { useState } from "react";
import { TbCalendar, TbCheck } from "react-icons/tb";
import {
  Button,
  ButtonLink,
  ComboBox,
  FormField,
  Select,
} from "@/components/ui";
import { PhotoIcon } from "@/components/ui/RecordIcons/RecordIcons";
import type { Cat } from "@/db/schema";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import { Surface } from "@/features/shared/Surface";
import type { CatFormState } from "./actions";
import { BirthDateField } from "./BirthDateField";
import { CAT_BREEDS, matchesBreed } from "./breeds";
import styles from "./CatForm.module.css";
import { CatIcon } from "./CatIcon";
import { ProfileImageField } from "./ProfileImageField";

type CatFormProps = {
  action: (state: CatFormState, formData: FormData) => Promise<CatFormState>;
  cat?: Cat;
  submitLabel: string;
};

const initialState: CatFormState = {};

const SEX_OPTIONS: { value: Cat["sex"]; label: string }[] = [
  { value: "female", label: "メス" },
  { value: "male", label: "オス" },
  { value: "unknown", label: "不明" },
];

const BREED_OPTIONS = CAT_BREEDS.map((breed) => ({
  value: breed.name,
  label: breed.name,
}));

export function CatForm({ action, cat, submitLabel }: CatFormProps) {
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );
  const [isProfileImageBusy, setIsProfileImageBusy] = useState(false);

  return (
    <form action={formAction} className={styles.form}>
      <Surface
        titleId="cat-basic-heading"
        title="基本情報"
        titleSize="lg"
        icon={<CatIcon aria-hidden="true" size={24} />}
        gap="md"
      >
        <FormField
          name="name"
          label="名前"
          defaultValue={cat?.name}
          errorMessage={state.fieldErrors?.name?.[0]}
          isRequired
        />

        <Select
          name="sex"
          label="性別"
          options={SEX_OPTIONS}
          defaultSelectedKey={cat?.sex ?? "unknown"}
          errorMessage={state.fieldErrors?.sex?.[0]}
        />

        <ComboBox
          name="breed"
          label="猫種"
          options={BREED_OPTIONS}
          defaultInputValue={cat?.breed ?? ""}
          defaultFilter={matchesBreed}
          errorMessage={state.fieldErrors?.breed?.[0]}
          allowsCustomValue
        />
      </Surface>
      {cat ? (
        <Surface
          titleId="cat-profile-image-heading"
          title="プロフィール画像"
          titleSize="lg"
          icon={<PhotoIcon aria-hidden="true" size={24} />}
          gap="md"
        >
          <p className={styles.description}>
            画像を選ぶと、正方形に切り抜く範囲を調整できます。
          </p>
          <ProfileImageField
            catName={cat.name}
            profileMediaAssetId={cat.profileMediaAssetId}
            onBusyChange={setIsProfileImageBusy}
            isDisabled={isPending}
          />
        </Surface>
      ) : null}
      <Surface
        titleId="cat-dates-heading"
        title="大切な日"
        titleSize="lg"
        icon={<TbCalendar aria-hidden="true" size={20} />}
        gap="md"
      >
        <p className={styles.description}>
          わかる日付だけ入力できます。あとから変更することもできます。
        </p>
        <div className={styles.dateFields}>
          {/* 送信後にフォームがリセットされると、入力欄はマウント時の値に戻る。
              入力エラーで戻したときは送信した値で作り直し、エラーの出た入力欄と入力した値を表示する */}
          <BirthDateField
            key={JSON.stringify(state.submittedBirthDate ?? null)}
            cat={cat}
            submitted={state.submittedBirthDate}
            fieldErrors={state.fieldErrors}
          />

          <FormField
            name="adoptedAt"
            label="お迎え日"
            type="date"
            defaultValue={cat?.adoptedAt ?? ""}
            errorMessage={state.fieldErrors?.adoptedAt?.[0]}
          />
        </div>
      </Surface>

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={isPending || isProfileImageBusy}
          leftIcon={TbCheck}
        >
          {isPending ? "保存中..." : submitLabel}
        </Button>
        <ButtonLink
          href={cat ? `/cats/${cat.id}` : "/cats"}
          variant="secondary"
        >
          キャンセル
        </ButtonLink>
      </div>
    </form>
  );
}
