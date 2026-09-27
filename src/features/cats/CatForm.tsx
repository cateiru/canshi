"use client";

import { useActionState, useState } from "react";
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
import type { CatFormState } from "./actions";
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
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [isProfileImageBusy, setIsProfileImageBusy] = useState(false);

  return (
    <form action={formAction} className={styles.form}>
      <section className={styles.section} aria-labelledby="cat-basic-heading">
        <h2 id="cat-basic-heading" className={styles.sectionHeading}>
          <CatIcon aria-hidden="true" size={24} />
          基本情報
        </h2>
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
      </section>
      {cat ? (
        <section
          className={styles.section}
          aria-labelledby="cat-profile-image-heading"
        >
          <h2 id="cat-profile-image-heading" className={styles.sectionHeading}>
            <PhotoIcon aria-hidden="true" size={24} />
            プロフィール画像
          </h2>
          <p className={styles.description}>
            画像を選ぶと、正方形に切り抜く範囲を調整できます。
          </p>
          <ProfileImageField
            catName={cat.name}
            profileMediaAssetId={cat.profileMediaAssetId}
            profileCropX={cat.profileCropX}
            profileCropY={cat.profileCropY}
            profileCropZoom={cat.profileCropZoom}
            profileCropRotation={cat.profileCropRotation}
            onBusyChange={setIsProfileImageBusy}
            isDisabled={isPending}
          />
        </section>
      ) : null}
      <section className={styles.section} aria-labelledby="cat-dates-heading">
        <h2 id="cat-dates-heading" className={styles.sectionHeading}>
          <TbCalendar aria-hidden="true" size={20} />
          大切な日
        </h2>
        <p className={styles.description}>
          わかる日付だけ入力できます。あとから変更することもできます。
        </p>
        <div className={styles.dateFields}>
          <FormField
            name="birthDate"
            label="生年月日"
            type="date"
            defaultValue={cat?.birthDate ?? ""}
            errorMessage={state.fieldErrors?.birthDate?.[0]}
          />

          <FormField
            name="adoptedAt"
            label="お迎え日"
            type="date"
            defaultValue={cat?.adoptedAt ?? ""}
            errorMessage={state.fieldErrors?.adoptedAt?.[0]}
          />
        </div>
      </section>

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          isDisabled={isPending || isProfileImageBusy}
        >
          <TbCheck aria-hidden="true" size={18} />
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
